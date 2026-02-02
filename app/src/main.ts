import { doGet, onOpen, showHtml } from "./event";
import { fetchJobcanFormData, getRingiReception } from "./rest";
global.onOpen = onOpen;
global.fetchJobcanFormData = fetchJobcanFormData;
global.getRingiReception = getRingiReception;
global.doGet = doGet;
global.showHtml = showHtml;
