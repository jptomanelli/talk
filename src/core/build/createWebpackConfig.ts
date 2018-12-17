import CaseSensitivePathsPlugin from "case-sensitive-paths-webpack-plugin";
import CompressionPlugin from "compression-webpack-plugin";
import HtmlWebpackPlugin, { Options } from "html-webpack-plugin";
import { identity } from "lodash";
import LodashModuleReplacementPlugin from "lodash-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";
import InterpolateHtmlPlugin from "react-dev-utils/InterpolateHtmlPlugin";
import WatchMissingNodeModulesPlugin from "react-dev-utils/WatchMissingNodeModulesPlugin";
import TerserPlugin from "terser-webpack-plugin";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import webpack, { Configuration, Plugin } from "webpack";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import ManifestPlugin from "webpack-manifest-plugin";

import paths from "./paths";
import PublicURIWebpackPlugin from "./plugins/PublicURIWebpackPlugin";

/**
 * filterPlugins will filter out null values from the array of plugins, allowing
 * easy embedded ternaries.
 *
 * @param plugins array of plugins and null values
 */
const filterPlugins = (plugins: Array<Plugin | null>): Plugin[] =>
  plugins.filter(identity) as Plugin[];

interface CreateWebpackConfig {
  publicPath?: string;
  publicURL?: string;
  env?: Record<string, string>;
  disableSourcemaps?: boolean;
  appendPlugins?: any[];
}

export default function createWebpackConfig({
  publicPath = "/",
  publicURL = "",
  env = process.env as Record<string, string>,
  appendPlugins = [],
  disableSourcemaps,
}: CreateWebpackConfig = {}): Configuration[] {
  const envStringified = {
    "process.env": Object.keys(env).reduce<Record<string, string>>(
      (result, key) => {
        result[key] = JSON.stringify(env[key]);
        return result;
      },
      {}
    ),
  };

  const isProduction = env.NODE_ENV === "production";

  /**
   * ifProduction will only include the nodes if we're in production mode.
   */
  const ifProduction = isProduction
    ? <T extends {}>(...nodes: T[]) => nodes
    : <T extends {}>(...nodes: T[]) => [];

  const htmlWebpackConfig: Options = {
    minify: isProduction && {
      removeComments: true,
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    },
  };

  const styleLoader = {
    loader: require.resolve("style-loader"),
    options: {
      hmr: !isProduction,
    },
  };

  const localesOptions = {
    pathToLocales: paths.appLocales,

    // Default locale if non could be negotiated.
    defaultLocale: "en-US",

    // Fallback locale if a translation was not found.
    // If not set, will use the text that is already
    // in the code base.
    fallbackLocale: "en-US",

    // Common fluent files are always included in the locale bundles.
    commonFiles: ["framework.ftl", "common.ftl"],

    // Locales that come with the main bundle. Others are loaded on demand.
    bundled: ["en-US"],

    // All available locales can be loadable on demand.
    // To restrict available locales set:
    // availableLocales: ["en-US"],
  };

  const additionalPlugins = isProduction
    ? [
        new MiniCssExtractPlugin({
          filename: "assets/css/[name].[hash].css",
          chunkFilename: "assets/css/[id].[hash].css",
        }),
        // Pre-compress all the assets as they will be served as is.
        new CompressionPlugin({}),
      ]
    : [
        // Add module names to factory functions so they appear in browser profiler.
        new webpack.NamedModulesPlugin(),
        // This is necessary to emit hot updates (currently CSS only):
        new webpack.HotModuleReplacementPlugin(),
        // Watcher doesn't work well if you mistype casing in a path so we use
        // a plugin that prints an error when you attempt to do this.
        // See https://github.com/facebookincubator/create-react-app/issues/240
        new CaseSensitivePathsPlugin(),
        // If you require a missing module and then `npm install` it, you still have
        // to restart the development server for Webpack to discover it. This plugin
        // makes the discovery automatic so you don't have to restart.
        // See https://github.com/facebookincubator/create-react-app/issues/186
        new WatchMissingNodeModulesPlugin(paths.appNodeModules),
      ];

  // If the WEBPACK_STATS environment variable is specified, output the stats!
  const includeStats = Boolean(process.env.WEBPACK_STATS);

  const baseConfig: Configuration = {
    // Set webpack mode.
    mode: isProduction ? "production" : "development",
    optimization: {
      concatenateModules: isProduction,
      providedExports: true,
      usedExports: true,
      sideEffects: true,
      // We also minimize during development but only
      // limit it to dead code and unused code elemination
      // to be sure nothing breaks later in the production build.
      //
      // If modules are written in a side-effects free way this
      // should not happen. We strive to write side-effects free
      // modules but no one is perfect ;-)
      minimize: true,
      minimizer: [
        // Minify the code.
        new TerserPlugin({
          terserOptions: {
            compress: isProduction
              ? {}
              : {
                  defaults: false,
                  dead_code: true,
                  pure_getters: true,
                  side_effects: true,
                  unused: true,
                },
            mangle: isProduction && {},
            output: {
              comments: !isProduction,
              // Turned on because emoji and regex is not minified properly using default
              // https://github.com/facebookincubator/create-react-app/issues/2488
              ascii_only: true,
            },
            safari10: true,
          },
          cache: true,
          parallel: true,
          sourceMap: !disableSourcemaps,
        }),
      ],
    },
    devtool:
      !disableSourcemaps && isProduction
        ? // We generate sourcemaps in production. This is slow but gives good results.
          // You can exclude the *.map files from the build during deployment.
          "source-map"
        : // You may want 'eval' instead if you prefer to see the compiled output in DevTools.
          // See the discussion in https://github.com/facebookincubator/create-react-app/issues/343.
          "cheap-module-source-map",
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    // The first two entry points enable "hot" CSS and auto-refreshes for JS.
    output: {
      // Add /* filename */ comments to generated require()s in the output.
      pathinfo: !isProduction,
      // The dist folder.
      path: paths.appDistStatic,
      // Generated JS file names (with nested folders).
      // There will be one main bundle, and one file per asynchronous chunk.
      filename: isProduction
        ? "assets/js/[name].[chunkhash:8].js"
        : "assets/js/[name].js",
      chunkFilename: isProduction
        ? "assets/js/[name].[chunkhash:8].chunk.js"
        : "assets/js/[name].chunk.js",
      // We inferred the "public path" (such as / or /my-project) from homepage.
      publicPath,
      // Point sourcemap entries to original disk location (format as URL on Windows)
      devtoolModuleFilenameTemplate: (info: any) =>
        path
          .relative(paths.appSrc, info.absoluteResourcePath)
          .replace(/\\/g, "/"),
    },
    resolve: {
      extensions: [".js", ".json", ".ts", ".tsx"],
      plugins: [
        // Support `tsconfig.json` `path` setting.
        new TsconfigPathsPlugin({
          configFile: paths.appTsconfig,
          extensions: [".js", ".ts", ".tsx"],
        }),
      ],
    },
    resolveLoader: {
      // Add path to our own loaders.
      modules: ["node_modules", paths.appLoaders],
    },
    module: {
      strictExportPresence: true,
      rules: [
        // Disable require.ensure as it's not a standard language feature.
        { parser: { requireEnsure: false } },

        // First, run the linter.
        // It's important to do this before Babel processes the JS.
        {
          test: /\.(js|ts|tsx)$/,
          enforce: "pre",
          use: [
            {
              options: {
                tsConfigFile: paths.appTsconfig,
              },
              loader: require.resolve("tslint-loader"),
            },
          ],
          include: paths.appSrc,
        },
        {
          // "oneOf" will traverse all following loaders until one will
          // match the requirements. When no loader matches it will fall
          // back to the "file" loader at the end of the loader list.
          oneOf: [
            {
              test: paths.appStreamLocalesTemplate,
              use: [
                // This is the locales loader that loads available locales
                // from a particular target.
                {
                  loader: "locales-loader",
                  options: {
                    ...localesOptions,
                    // Target specifies the prefix for fluent files to be loaded.
                    // ${target}-xyz.ftl and ${†arget}.ftl are loaded into the locales.
                    target: "stream",
                  },
                },
              ],
            },
            {
              test: paths.appAuthLocalesTemplate,
              use: [
                // This is the locales loader that loads available locales
                // from a particular target.
                {
                  loader: "locales-loader",
                  options: {
                    ...localesOptions,
                    // Target specifies the prefix for fluent files to be loaded.
                    // ${target}-xyz.ftl and ${†arget}.ftl are loaded into the locales.
                    target: "auth",
                  },
                },
              ],
            },
            {
              test: paths.appAdminLocalesTemplate,
              use: [
                // This is the locales loader that loads available locales
                // from a particular target.
                {
                  loader: "locales-loader",
                  options: {
                    ...localesOptions,
                    // Target specifies the prefix for fluent files to be loaded.
                    // ${target}-xyz.ftl and ${†arget}.ftl are loaded into the locales.
                    target: "admin",
                  },
                },
              ],
            },
            {
              test: paths.appInstallLocalesTemplate,
              use: [
                // This is the locales loader that loads available locales
                // from a particular target.
                {
                  loader: "locales-loader",
                  options: {
                    ...localesOptions,
                    // Target specifies the prefix for fluent files to be loaded.
                    // ${target}-xyz.ftl and ${†arget}.ftl are loaded into the locales.
                    target: "install",
                  },
                },
              ],
            },
            // Loader for our fluent files.
            {
              test: /\.ftl$/,
              use: ["raw-loader"],
            },
            // "url" loader works like "file" loader except that it embeds assets
            // smaller than specified limit in bytes as data URLs to avoid requests.
            // A missing `test` is equivalent to a match.
            {
              test: [/\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
              loader: require.resolve("url-loader"),
              options: {
                limit: 10000,
                name: "assets/media/[name].[hash:8].[ext]",
              },
            },
            // Process JS with Babel.
            {
              test: /\.(ts|tsx)$/,
              include: paths.appSrc,
              use: [
                {
                  loader: require.resolve("babel-loader"),
                  options: {
                    // This is a feature of `babel-loader` for webpack (not Babel itself).
                    // It enables caching results in ./node_modules/.cache/babel-loader/
                    // directory for faster rebuilds.
                    cacheDirectory: true,
                  },
                },
                {
                  loader: "ts-loader",
                  options: {
                    configFile: paths.appTsconfig,
                    compilerOptions: {
                      target: "es2015",
                      module: "esnext",
                      jsx: "preserve",
                      noEmit: false,
                    },

                    // Overwrites the behavior of `include` and `exclude` to only
                    // include files that are actually being imported and which
                    // are necessary to compile the bundle.
                    onlyCompileBundledFiles: true,
                  },
                },
              ],
            },
            // Makes sure node_modules are transpiled the way we need them to be.
            {
              test: /\.js$/,
              include: /node_modules\//,
              use: [
                {
                  loader: require.resolve("babel-loader"),
                  options: {
                    // This will ensure that all packages in node_modules that
                    // import lodash do so in a way that supports tree shaking.
                    plugins: ["lodash"],
                    presets: [
                      [
                        "@babel/env",
                        { targets: "last 2 versions, ie 11", modules: false },
                      ],
                    ],
                    cacheDirectory: true,
                  },
                },
              ],
            },
            // "postcss" loader applies autoprefixer to our CSS.
            // "css" loader resolves paths in CSS and adds assets as dependencies.
            // "style" loader turns CSS into JS modules that inject <style> tags.
            // In production, we use a plugin to extract that CSS to a file, and
            // in development "style" loader enables hot editing of CSS.
            {
              test: /\.css$/,
              use: [
                isProduction ? MiniCssExtractPlugin.loader : styleLoader,
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    modules: true,
                    importLoaders: 1,
                    localIdentName: "[name]-[local]-[hash:base64:5]",
                    minimize: isProduction,
                    sourceMap: isProduction && !disableSourcemaps,
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                  options: {
                    config: {
                      path: paths.appPostCssConfig,
                    },
                  },
                },
              ],
            },
            // "file" loader makes sure those assets get served by WebpackDevServer.
            // When you `import` an asset, you get its (virtual) filename.
            // In production, they would get copied to the `build` folder.
            // This loader doesn't use a "test" so it will catch all modules
            // that fall through the other loaders.
            {
              // Exclude `js` files to keep "css" loader working as it injects
              // its runtime that would otherwise processed through "file" loader.
              // Also exclude `html` and `json` extensions so they get processed
              // by webpacks internal loaders.
              exclude: [/\.(js|ts|tsx)$/, /\.html$/, /\.json$/],
              loader: require.resolve("file-loader"),
              options: {
                name: "assets/media/[name].[hash:8].[ext]",
              },
            },
          ],
        },
        // ** STOP ** Are you adding a new loader?
        // Make sure to add the new loader(s) before the "file" loader.
      ],
    },
    plugins: [
      new LodashModuleReplacementPlugin(),
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === 'development') { ... }. See `./env.js`.
      new webpack.DefinePlugin(envStringified),
      ...additionalPlugins,
      ...appendPlugins,
    ],
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      dgram: "empty",
      fs: "empty",
      net: "empty",
      tls: "empty",
      child_process: "empty",
    },
    // Turn off performance hints during development because we don't do any
    // splitting or minification in interest of speed. These warnings become
    // cumbersome.
    performance: {
      hints: isProduction && "warning",
    },
  };

  const devServerEntries = isProduction
    ? []
    : [
        // Include an alternative client for WebpackDevServer. A client's job is to
        // connect to WebpackDevServer by a socket and get notified about changes.
        // When you save a file, the client will either apply hot updates (in case
        // of CSS changes), or refresh the page (in case of JS changes). When you
        // make a syntax error, this client will display a syntax error overlay.
        // Note: instead of the default WebpackDevServer client, we use a custom one
        // to bring better experience for Create React App users. You can replace
        // the line below with these two lines if you prefer the stock client:
        // require.resolve('webpack-dev-server/client') + '?/',
        // require.resolve('webpack/hot/dev-server'),
        require.resolve("react-dev-utils/webpackHotDevClient"),
      ];

  return [
    /* Webpack config for our different target, e.g. stream, admin... */
    {
      ...baseConfig,
      entry: {
        stream: [
          // We ship polyfills by default
          paths.appPolyfill,
          ...ifProduction(paths.appPublicPath),
          ...devServerEntries,
          paths.appStreamIndex,
        ],
        auth: [
          // We ship polyfills by default
          paths.appPolyfill,
          ...ifProduction(paths.appPublicPath),
          ...devServerEntries,
          paths.appAuthIndex,
          // Remove deactivated entries.
        ],
        install: [
          // We ship polyfills by default
          paths.appPolyfill,
          ...ifProduction(paths.appPublicPath),
          ...devServerEntries,
          paths.appInstallIndex,
        ],
        admin: [
          // We ship polyfills by default
          paths.appPolyfill,
          ...ifProduction(paths.appPublicPath),
          ...devServerEntries,
          paths.appAdminIndex,
        ],
      },
      plugins: filterPlugins([
        ...baseConfig.plugins!,
        // Generates an `stream.html` file with the <script> injected.
        new HtmlWebpackPlugin({
          filename: "stream.html",
          template: paths.appStreamHTML,
          chunks: ["stream"],
          inject: "body",
          ...htmlWebpackConfig,
        }),
        // Generates an `auth.html` file with the <script> injected.
        new HtmlWebpackPlugin({
          filename: "auth.html",
          template: paths.appAuthHTML,
          chunks: ["auth"],
          inject: "body",
          ...htmlWebpackConfig,
        }),
        // Generates an `install.html` file with the <script> injected.
        new HtmlWebpackPlugin({
          filename: "install.html",
          template: paths.appInstallHTML,
          chunks: ["install"],
          inject: "body",
          ...htmlWebpackConfig,
        }),
        // Generates an `admin.html` file with the <script> injected.
        new HtmlWebpackPlugin({
          filename: "admin.html",
          template: paths.appAdminHTML,
          chunks: ["admin"],
          inject: "body",
          ...htmlWebpackConfig,
        }),
        ...ifProduction(
          // Inject the pieces we need here to resolve all the now relative url's
          // against the CDN if it's provided. It will inject the following into
          // the configuration blob on the page.
          new PublicURIWebpackPlugin(
            "{{ staticURI | dump | safe }}",
            "{{ staticURI }}"
          )
        ),
        // Makes some environment variables available in index.html.
        // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
        // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
        // In development, this will be an empty string.
        new InterpolateHtmlPlugin(env),
        // Generate a manifest file which contains a mapping of all asset filenames
        // to their corresponding output file so that tools can pick it up without
        // having to parse `index.html`.
        new ManifestPlugin({
          fileName: "asset-manifest.json",
        }),
        // If stats are enabled, output them!
        includeStats
          ? new BundleAnalyzerPlugin({
              analyzerMode: "static",
              reportFilename: "report-assets.html",
            })
          : null,
      ]),
    },
    /* Webpack config for our embed */
    {
      ...baseConfig,
      entry: [
        /* Use minimal amount of polyfills (for IE) */
        "intersection-observer", // also for Safari
        ...devServerEntries,
        paths.appEmbedIndex,
      ],
      output: {
        ...baseConfig.output,
        library: "Coral",
        // don't hash the embed, cache-busting must be completed by the requester
        // as this lives in a static template on the embed site.
        filename: "assets/js/embed.js",
      },
      plugins: filterPlugins([
        ...baseConfig.plugins!,
        ...(isProduction
          ? []
          : [
              // Generates an `embed.html` file with the <script> injected.
              new HtmlWebpackPlugin({
                filename: "embed.html",
                template: paths.appEmbedHTML,
                inject: "head",
                ...htmlWebpackConfig,
              }),
              new HtmlWebpackPlugin({
                filename: "story.html",
                template: paths.appEmbedStoryHTML,
                inject: "head",
                ...htmlWebpackConfig,
              }),
              new HtmlWebpackPlugin({
                filename: "storyButton.html",
                template: paths.appEmbedStoryButtonHTML,
                inject: "head",
                ...htmlWebpackConfig,
              }),
              // Makes some environment variables available in index.html.
              // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
              // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
              // In development, this will be an empty string.
              new InterpolateHtmlPlugin(env),
            ]),
        // Generate a manifest file which contains a mapping of all asset filenames
        // to their corresponding output file so that tools can pick it up without
        // having to parse `index.html`.
        new ManifestPlugin({
          fileName: "embed-manifest.json",
        }),
        // If stats are enabled, output them!
        includeStats
          ? new BundleAnalyzerPlugin({
              analyzerMode: "static",
              reportFilename: "report-embed.html",
            })
          : null,
      ]),
    },
  ];
}