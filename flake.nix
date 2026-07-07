{
  description = "plandeck — local plan/MDX document viewer (self-contained binary)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      # Bump `version` and all three sha256 on every release — they come from the
      # GitHub Release `SHA256SUMS.txt` (sha256sum hex == nix fetchurl hash).
      version = "0.1.14";

      assets = {
        "x86_64-linux" = {
          file = "plandeck-linux-x64";
          sha256 = "1061566037971a1104d040edaa81f635e4293a48e8e751e55d41afe37276e2bc";
        };
        "aarch64-linux" = {
          file = "plandeck-linux-arm64";
          sha256 = "81878f1e7cd901232c75affa75a2e949a0df4bce1d950877a00d6272ec7e9a9c";
        };
        "aarch64-darwin" = {
          file = "plandeck-darwin-arm64";
          sha256 = "45d51191a70d67159526d236c4bcf376bed10e820f3d3ed69952f32746634cb1";
        };
      };

      systems = builtins.attrNames assets;
      forAllSystems = nixpkgs.lib.genAttrs systems;

      mkPlandeck =
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          asset = assets.${system};
          isLinux = pkgs.stdenv.isLinux;

          # A bun `--compile` binary appends the JS/SPA payload as a trailer AFTER
          # the ELF. patchelf/strip rewrite the ELF and break the payload offset —
          # the binary then silently falls back to the plain bun runtime (prints
          # bun help). So we must NOT modify the binary. Instead, on Linux we wrap
          # it to run under nixpkgs' glibc loader explicitly (bun tolerates
          # /proc/self/exe pointing at the loader). No nix-ld required. macOS uses
          # its native loader, so the raw binary is installed directly.
          libPath = pkgs.lib.makeLibraryPath [
            pkgs.stdenv.cc.cc.lib
            pkgs.glibc
          ];
        in
        pkgs.stdenv.mkDerivation {
          pname = "plandeck";
          inherit version;

          src = pkgs.fetchurl {
            url = "https://github.com/tigorlazuardi/plandeck/releases/download/v${version}/${asset.file}";
            inherit (asset) sha256;
          };

          dontUnpack = true;
          # Keep the bun trailer intact — block every ELF-touching fixup.
          dontStrip = true;
          dontPatchELF = true;

          nativeBuildInputs = pkgs.lib.optionals isLinux [ pkgs.makeWrapper ];

          installPhase =
            if isLinux then
              ''
                runHook preInstall
                install -Dm755 "$src" "$out/libexec/plandeck"
                makeWrapper "${pkgs.stdenv.cc.bintools.dynamicLinker}" "$out/bin/plandeck" \
                  --add-flags "--library-path ${libPath}" \
                  --add-flags "$out/libexec/plandeck"
                runHook postInstall
              ''
            else
              ''
                runHook preInstall
                install -Dm755 "$src" "$out/bin/plandeck"
                runHook postInstall
              '';

          meta = {
            description = "Local plan/MDX document viewer (self-contained binary)";
            homepage = "https://github.com/tigorlazuardi/plandeck";
            license = nixpkgs.lib.licenses.asl20;
            platforms = systems;
            mainProgram = "plandeck";
            sourceProvenance = [ nixpkgs.lib.sourceTypes.binaryNativeCode ];
          };
        };
    in
    {
      packages = forAllSystems (system: rec {
        plandeck = mkPlandeck system;
        default = plandeck;
      });

      apps = forAllSystems (system: rec {
        plandeck = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/plandeck";
        };
        default = plandeck;
      });
    };
}
