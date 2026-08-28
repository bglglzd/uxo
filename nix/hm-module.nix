# Home-manager module for UXO speech-to-text
#
# Provides a systemd user service for autostart.
# Usage: imports = [ uxo.homeManagerModules.default ];
#        services.uxo.enable = true;
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.uxo;
in
{
  options.services.uxo = {
    enable = lib.mkEnableOption "UXO speech-to-text user service";

    package = lib.mkOption {
      type = lib.types.package;
      defaultText = lib.literalExpression "uxo.packages.\${system}.uxo";
      description = "The UXO package to use.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.user.services.uxo = {
      Unit = {
        Description = "UXO speech-to-text";
        After = [ "graphical-session.target" ];
        PartOf = [ "graphical-session.target" ];
      };
      Service = {
        ExecStart = "${cfg.package}/bin/uxo";
        Restart = "on-failure";
        RestartSec = 5;
      };
      Install.WantedBy = [ "graphical-session.target" ];
    };
  };
}
