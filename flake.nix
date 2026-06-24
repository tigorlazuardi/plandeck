{
  description = "plandeck — local plan/MDX document viewer (self-contained binary)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      # Bump `version` and all three sha256 on every release — they come from the
      # GitHub Release `SHA256SUMS.txt` (sha256sum hex == nix fetchurl hash).
      version = "0.1.1";

      assets = {
        "x86_64-linux" = {
          file = "plandeck-linux-x64";
          sha256 = "4fc5df44beb828af3a3f5b0321e22fff43a33b2a14a8cfb864cb5da098a7de48";
        };
        "aarch64-linux" = {
          file = "plandeck-linux-arm64";
          sha256 = "aeed811797cd4033c34c0c513ce5ca520e3dff4ea19a1f76a133e2eb54cc03c3";
        };
        "aarch64-darwin" = {
          file = "plandeck-darwin-arm64";
          sha256 = "a103bf31104819070bd78f0d3c5c2fe46bf3d3bbc17df325f76b55e41290353e";
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
