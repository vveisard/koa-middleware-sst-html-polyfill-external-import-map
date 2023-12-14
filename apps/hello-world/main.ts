import * as Path from "node:path";
import Koa from "koa";
import serve from "koa-static";
import createPolyfillHtmlExternalImportMapMiddleware from "koa-middleware-sst-html-polyfill-external-import-map";

const port = 8080;
const servedDirectoryRelativePath = "./app"; // relative to this file
const opts = {};

// determine absolute path of the served directory
const servedDirectoryAbsolutePath = Path.resolve(
  Path.dirname(import.meta.file), // directory of this file
  servedDirectoryRelativePath
);

const polyfillHtmlExternalImportMapMiddleware = createPolyfillHtmlExternalImportMapMiddleware({
  servedDirectoryAbsolutePath: servedDirectoryAbsolutePath,
  getFilePathOfRequestUrl(initialRequestUrl: string){
    if(initialRequestUrl === '/') {
      return '/index.html'
    }

    return initialRequestUrl
  }
});

const app = new Koa();
app.use(polyfillHtmlExternalImportMapMiddleware);
app.use(serve(servedDirectoryRelativePath, opts));
app.listen(port);
