// A bundler shim, aliased in vite.config.ts for
// '@react-native/assets-registry/registry'.
//
// react-native-svg's web build imports the Metro asset registry to resolve
// numeric asset IDs (the `require('./icon.png')` pattern). React Native
// 0.88 no longer ships that package, so the import would fail to resolve
// under Vite even though this app never uses numeric asset sources: the
// gauge and the ambience layer pass colors, paths, and strings only.
//
// The shim keeps the import graph resolvable and answers the one function
// the web build calls. It is never executed in this app: resolveAssetUri
// only reaches for it when an Image source is a number, and no source in
// this codebase ever is.

export function getAssetByID(): null {
  return null;
}
