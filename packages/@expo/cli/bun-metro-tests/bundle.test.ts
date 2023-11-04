import * as fs from 'fs';
import * as path from 'path';

import { exportEmbedBundleAsync } from '../src/export/embed/exportEmbedAsync';

function fileExists(path: string): boolean {
  const stat = fs.statSync(path, { throwIfNoEntry: false });
  return Boolean(stat && stat.isFile());
}

beforeAll(() => {
  // Fixes an issue with bun and cacache
  process.env.EXPO_NO_CACHE = 'true';
  process.env.EXPO_USE_TREE_SHAKING = 'true';
  patchMetro();
});

afterAll(() => {
  delete process.env.EXPO_NO_CACHE;
});

// From Tommy https://discord.com/channels/514829729862516747/514832110595604510/1168973233014460478
function patchMetro() {
  require('metro-config/src/defaults/defaults').moduleSystem =
    require.resolve('./fixtures/empty.js');

  const DependencyGraph = require('metro/src/node-haste/DependencyGraph');

  // Patch `_createModuleResolver` and `_doesFileExist` to use `fs.existsSync`.
  DependencyGraph.prototype.orig__createModuleResolver =
    DependencyGraph.prototype._createModuleResolver;
  DependencyGraph.prototype._createModuleResolver = function (): void {
    const hasteFS = this._fileSystem;

    this._doesFileExist = (filePath: string): boolean => {
      return hasteFS.exists(filePath) || fileExists(filePath);
    };

    this.orig__createModuleResolver();
    if (typeof this._moduleResolver._options.resolveAsset !== 'function') {
      throw new Error('Could not find `resolveAsset` in `ModuleResolver`');
    }

    this._moduleResolver._options.resolveAsset = (
      dirPath: string,
      assetName: string,
      extension: string
    ) => {
      const basePath = dirPath + path.sep + assetName;
      const assets = [
        basePath + extension,
        ...this._config.resolver.assetResolutions.map(
          (resolution: string) => basePath + '@' + resolution + 'x' + extension
        ),
      ].filter(this._doesFileExist);
      return assets.length ? assets : null;
    };
  };

  // Since we will be resolving files outside of `watchFolders`, their hashes
  // will not be found. We'll return the `filePath` as they should be unique.
  DependencyGraph.prototype.orig_getSha1 = DependencyGraph.prototype.getSha1;
  DependencyGraph.prototype.getSha1 = function (filePath: string): string {
    try {
      return this.orig_getSha1(filePath);
    } catch (e) {
      // `ReferenceError` will always be thrown when Metro encounters a file
      // that does not exist in the Haste map.
      if (e instanceof ReferenceError) {
        return filePath;
      }

      throw e;
    }
  };
}

async function bundleProject(entry: string) {
  const projectRoot = path.join(__dirname, 'fixtures/one');
  console.time('metro');
  const clear = false;
  const output = path.join(projectRoot, './dist/output.js');
  const { bundle } = await exportEmbedBundleAsync(projectRoot, {
    entryFile: path.join(projectRoot, entry),
    bundleOutput: output,
    assetsDest: path.join(projectRoot, 'dist'),
    platform: 'ios',
    dev: false,
    resetCache: clear,
    resetGlobalCache: clear,
    maxWorkers: 1,
    minify: true,
    sourcemapUseAbsolutePath: false,
    verbose: true,
    unstableTransformProfile: 'default',
  });
  console.timeEnd('metro');

  console.log(bundle.code);

  // return bundle.code;
  return bundle.code.replace(
    `(function (global) {})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);`,
    ''
  );
}

it(`tree shakes standard named imports`, async () => {
  const output = await bundleProject('01-import/index.js');
  expect(output).not.toMatch('subtract');
});
// it(`does not tree shake cjs imports`, async () => {
//   const output = await bundleProject('01-import/index-require.js');
//   expect(output).toMatch('subtract');
// });
// // it(`does not tree shake barrel imports`, async () => {
// //   const output = await bundleProject('01-import/index-barrel-star.js');
// //   expect(output).toMatch('subtract');
// // });
// it(`does not tree shake star imports`, async () => {
//   const output = await bundleProject('01-import/index-star.js');
//   expect(output).toMatch('subtract');
// });
// it(`does not tree shake barrel getters`, async () => {
//   const output = await bundleProject('01-import/index-barrel-getters.js');
//   expect(output).toMatch('subtract');
// });
// it(`does not tree shake barrel with default`, async () => {
//   const output = await bundleProject('01-import/index-barrel-default-as.js');
//   expect(output).not.toMatch('subtract');
// });
// it(`does tree shake partial barrel imports`, async () => {
//   const output = await bundleProject('01-import/index-barrel-partial.js');
//   expect(output).not.toMatch('subtract');
// });
// it(`does tree shake default`, async () => {
//   const output = await bundleProject('01-import/index-default.js');
//   expect(output).not.toMatch('subtract');
// });
// it(`does tree shake import as`, async () => {
//   const output = await bundleProject('01-import/index-import-as.js');
//   expect(output).not.toMatch('subtract');
// });
