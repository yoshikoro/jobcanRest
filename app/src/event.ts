/**
 * @description オープンイベント（メニュー用）
 * @author yoshitaka <sato-yoshitaka@aktio.co.jp>
 * @date 30/07/2024
 */
export function onOpen(): void {
  const ui = SpreadsheetApp.getUi();
  const mn = ui.createMenu("menu");

  mn.addItem("認証", "init");
  mn.addItem("本社の稟議データを取得", "getRingiReception");
  mn.addItem("ジョブカン接続", "showHtml");
  mn.addToUi();
}

export function doGet(e: GoogleAppsScript.Events.DoGet) {
  //admin モード等を搭載するためのmodeパラメータを入れる
  const mode = e.parameter.mode;
  let htmlTemp;
  if (mode == undefined) {
    htmlTemp = HtmlService.createTemplateFromFile("index");
  } else {
    htmlTemp = HtmlService.createTemplateFromFile("index");
  }
  //テンプレートをレンダリング
  const outPut = htmlTemp.evaluate();
  //タイトルをセット
  //ファビコン
  //モバイル対応用のviewport設定はここでいれないと動かない
  outPut.addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  return outPut;
}

export function showHtml() {
  const htmlFileName = "index";
  const output = HtmlService.createTemplateFromFile(htmlFileName);
  const html = output.evaluate();
  SpreadsheetApp.getActiveSpreadsheet().show(html);
}
