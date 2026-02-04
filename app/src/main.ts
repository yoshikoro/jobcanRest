import { doGet, onOpen, showHtml } from "./event";
import { debugFetchAndDump } from "./restSample";
import { init } from "./core/setup";
//*基本構成*//
global.onOpen = onOpen;
global.doGet = doGet;
global.showHtml = showHtml;
global.init = init;
