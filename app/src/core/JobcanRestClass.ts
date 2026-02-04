//ref job2.d.ts
/**
 * @description ジョブカンに接続するクラス
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 04/02/2026
 * @export
 * @class RestJobcan
 */
export class RestJobcan {
  private BASEURL = `https://ssl.wf.jobcan.jp/wf_api/`;
  private token = "";
  constructor(token?: string) {
    const finalToken =
      token || PropertiesService.getScriptProperties().getProperty("token");
    if (!finalToken) {
      throw new Error("API Token not found プロパティへtokenをいれて下さい");
    } else {
      this.token = finalToken;
    }
  }
  /**
   * @description ジョブカンからデータを取得してコールバックに渡す
   * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
   * @date 04/02/2026
   * @param {string} startDate
   * @param {(request: Jobcan.V2RequestResult) => void} callback
   * @memberof RestJobcan
   */
  public walkAllRequests(
    startDate: string,
    callback: (request: Jobcan.V2RequestResult) => void,
  ) {
    let nextUrl: string | undefined = undefined;
    let hasNext = true;

    while (hasNext) {
      const response = this.getRequests(startDate, nextUrl);
      const requests = response.results;

      if (!requests || requests.length === 0) break;

      requests.forEach(callback);

      if (response.next) {
        nextUrl = response.next;
      } else {
        hasNext = false;
      }
    }
  }

  /**
   * @description
   * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
   * @date 05/11/2024
   * @param {string} appliedAfter
   * @param {string} [nextURL]
   * @param {Jobcan.jobcanStatusRequest} [status="in_progress"]
   * @returns {*}  {Jobcan.V2result}
   * @memberof RestJobcan
   */
  public getRequests(
    appliedAfter: string,
    nextURL?: string | undefined,
    status: Jobcan.jobcanStatusRequest = "in_progress", //"in_progress"
  ): Jobcan.V2result {
    let baseurl: string = this.BASEURL;
    if (nextURL) {
      baseurl = nextURL;
    }
    const reqString: string = `?applied_after=${appliedAfter}&status=${status}`;

    const requestUrl: string = `${baseurl}v2/requests/${reqString}`;

    let result: Jobcan.V2result = this.getFetch(requestUrl);
    return result;
  }
  /**
   * @description ジョブカンへ接続して情報を取得する
   * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
   * @date 21/10/2024
   * @param {string} request_id
   * @param {boolean} [onlyPart=true]
   * @returns {*}
   */
  public getCustomezedItemsByRequestId(
    request_id: string,
    onlyPart: boolean = true,
    progress: string = "in_progress",
  ): string[] {
    const baseurl = this.BASEURL;
    const requestUrl = `${baseurl}v1/requests/${request_id}/`;

    let result: Jobcan.JobcanResult = this.getFetch(requestUrl);
    if (onlyPart) {
      const INPROGRESS = progress;
      if (result.status !== INPROGRESS) {
        return [];
      }
    }
    let ret = [result.id, result.form_name];
    result.detail.customized_items.forEach(
      (element: Jobcan.CustomizedItem, index) => {
        Logger.log(element.title);
        ret.push(element.content ?? "");
      },
    );
    return ret;
  }
  /**
   * @description fetch
   * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
   * @date 31/10/2024
   * @private
   * @param {string} url
   * @param {GoogleAppsScript.URL_Fetch.HttpMethod} [method="get"]
   * @param {string} [payload=""]
   * @returns {*}  {JobcanResult}
   * @memberof RestJobcan
   */
  private getFetch<T>(
    url: string,
    method: GoogleAppsScript.URL_Fetch.HttpMethod = "get",
    payload: string = "",
  ): T {
    const pram: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: method,
      contentType: "application/json",
      muteHttpExceptions: false,
      payload: payload,
      headers: {
        Authorization: "token " + this.token,
      },
    };
    //レスポンスを受ける変数
    let res: GoogleAppsScript.URL_Fetch.HTTPResponse = UrlFetchApp.fetch(
      url,
      pram,
    );
    let resCode: number = res.getResponseCode();
    const content = res.getContentText();
    if (resCode === 200) {
      return JSON.parse(content) as T;
      // rescode is not 200 then error
    }
    throw new Error(
      `API Error: Status ${resCode}. Content: ${res.getContentText()}`,
    );
  }
}
