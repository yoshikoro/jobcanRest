import { CONFIG_DATA } from "../core/config";
import { CONSTVALUES } from "../core/constants";
import { RestJobcan } from "../core/JobcanRestClass";
import { getExistingIdsSet } from "../core/utils/SheetUtils";

/** 固有の定数を管理
 * A稟議とB稟議がありその稟議申請をAシートとBシートに分ける
 * A稟議シートとB稟議シートのカラムは基本同じで
 * A稟議の進捗状況シート（TARGETSHEET)のカラムも保持
 */
const ASHEET_INFO = {
  ASHEETNAME: "A",
  BSHEETNAME: "B",
  RECEP_NO_COLUMN: 3,
  ACCEPT_NO_COLUMN: 4,
  PDF_LINK_COLUMN: 10,
};

const TARGETSHEET_INFO = {
  //
  RINGI_STAGE_COLUMN: 1,
  RINGI_PREFIX_COLUMN: 7,
  RINGI_RECEPTNO_COLUMN: 8,
  RINGI_ACCEPTNO_COLUMN: 11,
};

/**
 * @description 本社稟議受付シートから決定番号を取得する
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 08/01/2026
 * @returns {*}  {void}
 */
export function getRingiReception(): void {
  const sp = SpreadsheetApp.getActiveSpreadsheet();
  const configSh = sp.getSheetByName(CONFIG_DATA.CONFIGSHEETNAME);
  const aSh = sp.getSheetByName(ASHEET_INFO.ASHEETNAME);
  if (!aSh || !configSh) {
    Logger.log("Aシート・Configシートがありません");
    return;
  }
  try {
    const aData = aSh.getDataRange().getValues();
    const acceptMap: Map<string, { rowIndex: number; rowData: string[] }> =
      new Map(
        aData.map((row, index) => [
          row[ASHEET_INFO.RECEP_NO_COLUMN],
          { rowIndex: index + 1, rowData: row }, //書き戻し用にRowを調整
        ]),
      );

    const tspid = configSh
      .getRange(CONFIG_DATA.RINGI_RECEPT_SPID_RNG)
      .getValue();
    const prefix = configSh.getRange(CONFIG_DATA.PREFIX_RNG).getValue();
    const tsp = SpreadsheetApp.openById(tspid);
    const tsh = getRingiReceptionSpreadsheetSheetName(tsp);
    const tData = tsh.getDataRange().getDisplayValues();
    const filterData = tData.filter((element) => {
      return element[TARGETSHEET_INFO.RINGI_PREFIX_COLUMN] === prefix;
    });
    if (!filterData || filterData.length === 0) {
      return;
    }
    filterData.forEach((tRow) => {
      const rNo = tRow[TARGETSHEET_INFO.RINGI_RECEPTNO_COLUMN]
        .toString()
        .padStart(4, "0000");
      const receptNo = `${tRow[TARGETSHEET_INFO.RINGI_PREFIX_COLUMN]}-${rNo}`;
      const match = acceptMap.get(receptNo);
      if (!match) {
        return;
      }
      try {
        const acceptNo =
          tRow[TARGETSHEET_INFO.RINGI_ACCEPTNO_COLUMN] ??
          tRow[TARGETSHEET_INFO.RINGI_STAGE_COLUMN];
        const { rowIndex } = match;
        aSh
          .getRange(rowIndex, ASHEET_INFO.ACCEPT_NO_COLUMN + 1)
          .setValue(acceptNo);
      } catch (error) {}
    });
  } catch (e) {
    const error: AppError = e as AppError;
    Logger.log(`エラー終了：${error.message}`);
  }
  SpreadsheetApp.flush();
  getRingiAcceptFileLink();
}

/**
 * @description 稟議決定ファイルをPDFリンクとして書き戻す
 * GoogleDriveにアクセスする権限がない場合はエラー
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 08/01/2026
 * @returns {*}  {void}
 */
function getRingiAcceptFileLink(): void {
  const sp = SpreadsheetApp.getActiveSpreadsheet();
  const configSh = sp.getSheetByName(CONFIG_DATA.CONFIGSHEETNAME);
  const aSh = sp.getSheetByName(ASHEET_INFO.ASHEETNAME);

  if (!aSh || !configSh) {
    Logger.log("Aシート・Configシートがありません");
    return;
  }

  try {
    const aData = aSh.getDataRange().getValues();

    // 1. PDF格納フォルダからファイルリストをプリロード
    const folderId = configSh
      .getRange(CONFIG_DATA.RINGI_ACCEPT_FOLDERID_RNG)
      .getValue();
    const rootFolder = DriveApp.getFolderById(folderId);
    const fullYear = new Date().getFullYear().toString();
    const tFolderIterator = rootFolder.getFoldersByName(`${fullYear}年`);
    const folder = tFolderIterator.hasNext() ? tFolderIterator.next() : null;
    if (!folder) {
      Logger.log("フォルダがありませんでした");
      return;
    }
    const files = folder.getFiles();

    const fileList: { name: string; url: string }[] = [];
    while (files.hasNext()) {
      const file = files.next();
      Logger.log(file.getName());

      fileList.push({ name: file.getName(), url: file.getUrl() });
    }

    // 2. Aシートのデータ（aData）をベースにループ
    aData.forEach((row, index) => {
      // 0ベースのインデックスを使用
      const acceptNo = row[ASHEET_INFO.ACCEPT_NO_COLUMN];
      const existingLink = row[ASHEET_INFO.PDF_LINK_COLUMN];
      const rowIndex = index + 1; // getRange用

      // ガード句：承認番号がない、または既にリンクがある場合はスキップ
      if (!acceptNo || !/\d/.test(String(acceptNo)) || existingLink) {
        return;
      }

      // --- PDFリンクの検索と書き戻し (部分一致) ---
      // aDataの承認番号文字列が含まれるファイルを検索
      const targetFile = fileList.find((file) =>
        file.name.includes(String(acceptNo)),
      );

      if (targetFile) {
        aSh
          .getRange(rowIndex, ASHEET_INFO.PDF_LINK_COLUMN + 1)
          .setValue(targetFile.url);
        Logger.log(`更新完了: 行 ${rowIndex} / 承認番号: ${acceptNo}`);
      }
    });
  } catch (e) {
    const error = e as AppError;
    Logger.log(`エラー終了：${error.message}`);
  }
}
/**
 * @description シート名称の解決を行う
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 08/01/2026
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} sp
 * @returns {*}  {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getRingiReceptionSpreadsheetSheetName(
  sp: GoogleAppsScript.Spreadsheet.Spreadsheet,
): GoogleAppsScript.Spreadsheet.Sheet {
  const dt = new Date();
  const currentYear = dt.getFullYear().toString();
  const sheets = sp.getSheets();
  const sheet = sheets.find((sheet) => {
    return sheet.getName().includes(currentYear);
  });
  if (!sheet) {
    throw new Error("対象のシートがありません");
  }
  return sheet;
}

/**
 * @description Jobcanにある申請データを取得してシートに書き戻す
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 08/01/2026
 * @export
 * @returns {*}
 */
export function fetchJobcanFormData() {
  const token = PropertiesService.getScriptProperties().getProperty(
    CONSTVALUES.TOKEN,
  );
  const ui = SpreadsheetApp.getUi();
  if (!token) {
    Logger.log("エラー: トークンが取得できません");
    ui.alert("tokenが取得出来ませんでした");
    return;
  }

  const jobcan = new RestJobcan(token);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSh = ss.getSheetByName(CONFIG_DATA.CONFIGSHEETNAME);
  const aSh = ss.getSheetByName(ASHEET_INFO.ASHEETNAME);
  const bSh = ss.getSheetByName(ASHEET_INFO.BSHEETNAME);
  if (!aSh || !bSh || !configSh) {
    return;
  }
  const counters = {
    A: parseInt(configSh.getRange(CONFIG_DATA.ACOUNT).getValue()),
    B: parseInt(configSh.getRange(CONFIG_DATA.BCOUNT).getValue()),
  };

  // !取得開始日の設定（昨日の日付）
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = Utilities.formatDate(yesterdayDate, "JST", "yyyy/MM/dd");

  // シートごとの既存IDを保持するキャッシュ（同じシートを何度も読み込まないため）
  const existingIdsCache: { [sheetName: string]: Set<string> } = {};

  try {
    Logger.log(`${yesterday} 以降の処理を開始します`);

    let nextUrl: string | undefined = undefined;
    let hasNext = true;

    while (hasNext) {
      // 1. リクエストを送信（2回目以降は nextUrl を使用）
      const response: Jobcan.V2result = jobcan.getRequests(yesterday, nextUrl);

      // レスポンスのフィールド名は APIの仕様（results または requests）に合わせて調整してください
      const currentRequests = response.results;

      if (!currentRequests || currentRequests.length === 0) {
        Logger.log("対象の申請データがありません");
        break;
      }

      // 2. 各申請をループ処理
      currentRequests.forEach((req) => {
        const formName = req.form_name;
        const requestId = req.id.toString();
        const linkUrl = `https://ssl.wf.jobcan.jp/#/requests/${requestId}`;
        //!Aを含んでいるか？
        const abSheet = formName.includes("A") ? aSh : bSh;

        const targetSheet = ss.getSheetByName(formName);
        //! フォーム名と一致する名前のシートがある場合のみ処理
        if (targetSheet) {
          // そのシートの既存IDリストを取得（キャッシュになければ作成）
          if (!existingIdsCache[formName]) {
            existingIdsCache[formName] = getExistingIdsSet(targetSheet);
          }

          // IDがすでに存在するかチェック
          if (existingIdsCache[formName].has(requestId)) {
            Logger.log(`スキップ（登録済）: [${formName}] ID ${requestId}`);
          } else {
            const type = formName.includes("A") ? "A" : "B";
            const areaName = CONSTVALUES.AREA_NAME;
            const serialNo = (counters[type]++).toString().padStart(4, "0");
            //! 連番設定をする場合は const approvalRequestNo = `${areaName}-${serialNo}`;
            const formula = `=HYPERLINK("https://ssl.wf.jobcan.jp/#/requests/${requestId}","${requestId}")`;
            const formData = [
              formula,
              req.applied_date,
              req.title,
              //! 連番設定を追記する場合はコメント解除 approvalRequestNo,
            ];
            //! 詳細情報を取得して追記
            const details = jobcan.getCustomezedItemsByRequestId(
              requestId,
              true,
            );
            if (details && details.length > 0) {
              //formDataの最後は申請コードなのでそこは採番を入れる
              //採番のロジックは決定待ち
              // details[0] が ID なので、ここをハイパーリンク数式に書き換える
              // 形式: =HYPERLINK("https://ssl.wf.jobcan.jp/#/requests/ID", "ID")
              /* 工場とフォームサイズが違う場合に使用
              details[0] = "決裁待ち";
              if (formName.includes("工場")) {
                details.splice(3, 0, details[2]);
              }
              */
              const appendData = [...formData, ...details];
              abSheet.appendRow(appendData);
              targetSheet.appendRow(appendData);
              existingIdsCache[formName].add(requestId);
              Logger.log(
                `[${formName}] にリンク付きで新規追記: ID ${requestId}`,
              );
            }
          }
        }
      });

      // 3. 次のページがあるか判定
      // Jobcan V2 API の next_url または links.next を確認
      const next = response.next;
      if (next) {
        nextUrl = next;
        Logger.log("次のページを取得します...");
      } else {
        hasNext = false;
      }
    }

    configSh.getRange(CONFIG_DATA.ACOUNT).setValue(counters.A);
    configSh.getRange(CONFIG_DATA.BCOUNT).setValue(counters.B);
    Logger.log(`カウンターを更新しました: A=${counters.A}, B=${counters.B}`);
    Logger.log("すべての処理が完了しました");
  } catch (e) {
    const error = e as AppError;
    Logger.log("エラーが発生しました: " + error.message);
  }
}
