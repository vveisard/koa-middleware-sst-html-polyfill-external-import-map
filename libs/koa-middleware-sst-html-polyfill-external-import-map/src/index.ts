import { ReadStream } from "node:fs";
import Path from "path-browserify";
import { Context, Next, ParameterizedContext } from "koa";

// @region-begin shape

export interface MiddlewareOptions {
  /**
   * Aboslute path (wrt file system) of the served directory being served.
   * nb, the path of the external source map is resolved using this path.
   */
  readonly servedDirectoryAbsolutePath: string;

  /**
   * Should the middleware run?
   * @remarks nb, only runs when response type is "text/html".
   * @default `true`.
   */
  readonly shouldRun?: (ctx: Context) => boolean;

  /**
   * Get the file path (wrt served directory) for a given request url.
   * eg, remap "/" request url to file path "/index.html"
   * @remarks
   * This is only run when response type is "text/html".
   * @returns file path (wrt served directory) of request url. 
   */
  readonly getFilePathOfRequestUrl: (initialRequestUrl: string) => string;
}

// @region-end

// @region-begin function

/**
 * Convert {@link ReadStream} to string.
 */
function readStreamToString(stream: ReadStream): Promise<string> {
  const chunks: Array<Buffer> = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

// @region-end

// @region-begin main

/**
 * Transform an response with external import map to "internalized" import map.
 * @param servedDirectoryAbsolutePath absolute path of the served directory being served (wrt file system).
 * @param htmlFilePath path of the HTML file (wrt served directory) being requested.
 */
const transformResponse = async (
  servedDirectoryAbsolutePath: string,
  htmlFilePath: string,
  initialResponse: Response
): Promise<Response> => {
  const htmlRewriter = new HTMLRewriter();

  htmlRewriter.on("*", {
    async element(el) {
      if (el.tagName !== "script") {
        return;
      }

      const typeAttribute = el.getAttribute("type");
      if (typeAttribute === null) {
        return;
      }

      if (typeAttribute !== "importmap") {
        return;
      }

      const srcAttribute = el.getAttribute("src");

      // ignore non-external source-maps
      if (srcAttribute === null) {
        return;
      }

      // determine absolute path (wrt file system) of external import map
      let externalImportMapAbsolutePath;
      if (Path.isAbsolute(srcAttribute)) {
        // src is absolute (wrt to served directory)
        externalImportMapAbsolutePath = Path.join(
          servedDirectoryAbsolutePath,
          srcAttribute
        );
      } else {
        // src is relative to the requested HTML file
        externalImportMapAbsolutePath = Path.resolve(
          Path.dirname(htmlFilePath),
          srcAttribute
        );
      }

      // import external import map as a JSON module
      const externalImportMapModule = await import(
        externalImportMapAbsolutePath,
        {
          assert: {
            type: "json",
          },
        }
      );

      // add contents of external import map directly to html
      el.removeAttribute("src");
      el.setInnerContent(JSON.stringify(externalImportMapModule.default));
    },
  });

  return htmlRewriter.transform(initialResponse);
};

/**
 * Create the middleware using options.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function createMiddleware(options: MiddlewareOptions) {
  return async (ctx: ParameterizedContext, next: Next) => {
    await next();

    if (!ctx.response.is("text/html")) {
      return;
    }

    // condition check
    if ((options.shouldRun?.(ctx) ?? true) === false) {
      return;
    }

    // determine absolute path (wrt file system) of the requested HTML file
    const requestHtmlFileAbsolutePath = Path.join(
      options.servedDirectoryAbsolutePath,
      options.getFilePathOfRequestUrl(ctx.request.url)
    );

    const responseBody: unknown = ctx.response.body;
    if (typeof responseBody === "string") {
      const transformedResponse = await transformResponse(
        options.servedDirectoryAbsolutePath,
        requestHtmlFileAbsolutePath,
        new Response(responseBody)
      );
      const transformedCode = await (await transformedResponse.blob()).text();

      ctx.response.body = transformedCode;
      ctx.response.type = "text/html";
    } else if (responseBody instanceof Uint8Array) {
      const transformedResponse = await transformResponse(
        options.servedDirectoryAbsolutePath,
        requestHtmlFileAbsolutePath,
        new Response(responseBody)
      );
      const transformedCode = await (await transformedResponse.blob()).text();

      ctx.response.body = transformedCode;
      ctx.response.type = "text/html";
    } else if (responseBody instanceof ReadStream) {
      const initialCode = await readStreamToString(responseBody);
      const transformedResponse = await transformResponse(
        options.servedDirectoryAbsolutePath,
        requestHtmlFileAbsolutePath,
        new Response(initialCode)
      );
      const transformedCode = await (await transformedResponse.blob()).text();

      ctx.response.body = transformedCode;
      ctx.response.type = "text/html";
    } else {
      throw new Error(
        `Not supported! response.body type '${responseBody?.constructor.name}'`
      );
    }
  };
};

// @region-end