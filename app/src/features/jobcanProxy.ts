import { RestJobcan } from "../core/JobcanRestClass";

/**
 * Jobcan Proxy のメインハンドラー
 */
export function handleJobcanProxy(e: GoogleAppsScript.Events.DoGet) {
  // 1. パラメータがない場合はドキュメントを表示
  if (!e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("Jobcan Proxy API Document")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  }

  // 2. パラメータがある場合は API として処理
  const action = e.parameter.action;

  try {
    const jobcan = new RestJobcan();

    switch (action) {
      case "walk": {
        const date = e.parameter.date || "";
        const allResults: any[] = [];
        jobcan.walkAllRequests(date, (req) => allResults.push(req));
        return createJsonResponse({
          status: "success",
          count: allResults.length,
          data: allResults,
        });
      }

      case "detail": {
        const id = e.parameter.id;
        if (!id)
          throw new Error("Parameter 'id' is required for action 'detail'");
        const detail = jobcan.getCustomezedItemsByRequestId(id, false);
        return createJsonResponse({ status: "success", data: detail });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * JSONレスポンス生成用ヘルパー
 */
function createJsonResponse(data: object) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
