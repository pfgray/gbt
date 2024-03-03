{
  description = "A Graph Build Tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      gbt = pkgs.callPackage ./. {};
    in {
      devShell = pkgs.mkShell {
        packages = [
          # bun.packages.${system}.v0_1_6
          pkgs.nodejs
          pkgs.yarn
        ];
      };
      packages = {
        gbt = gbt.build;
        default = gbt.build;
      };
      apps.gbt = flake-utils.lib.mkApp {
        drv = gbt.build;
      };
    });
}
