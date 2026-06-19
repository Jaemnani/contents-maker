// Remotion Studio/CLI config. Programmatic render uses lib/render-remotion/engine.ts.
import { Config } from "@remotion/cli/config";
import path from "path";

Config.setEntryPoint("./remotion/index.ts");
// WebGL2 for shader transitions (zoom-blur, dreamy-zoom …) in CLI/Studio renders.
Config.setChromiumOpenGlRenderer("angle");
Config.overrideWebpackConfig((conf) => ({
  ...conf,
  resolve: {
    ...conf.resolve,
    alias: { ...(conf.resolve?.alias ?? {}), "@": path.join(process.cwd()) },
  },
}));
