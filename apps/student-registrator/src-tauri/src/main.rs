#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod application;
mod domain;
mod infrastructure;
mod interfaces;
mod shared;

mod api;
mod command_services;
mod commands;
mod hikvision;
mod storage;
mod types;

fn main() {
    app::run::run();
}
