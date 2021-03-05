
export type HeaderMenus = "none" | "download" | "tutorial" | "tools";
export type HeaderPopups = "none" | "login" | "quick_start" | "keyboard_shortcuts" | "expr_to_circuit";

export type HeaderState = {
    curMenu: HeaderMenus;
    curPopup: HeaderPopups;
}
