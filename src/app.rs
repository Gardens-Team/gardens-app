#![allow(non_snake_case)]

use dioxus::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use crate::styles::Stylesheet;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["window", "__TAURI__", "core"])]
    async fn invoke(cmd: &str, args: JsValue) -> JsValue;
}

#[derive(Serialize, Deserialize)]
struct GreetArgs<'a> {
    name: &'a str,
}

pub fn App() -> Element {
    let mut name = use_signal(|| String::new());
    let mut greet_msg = use_signal(|| String::new());

    let greet = move |_: FormEvent| async move {
        if name.read().is_empty() {
            return;
        }

        let name = name.read();
        let args = serde_wasm_bindgen::to_value(&GreetArgs { name: &*name }).unwrap();
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        let new_msg = invoke("greet", args).await.as_string().unwrap();
        greet_msg.set(new_msg);
    };

    rsx! {
        // Load Tailwind CSS
        Stylesheet {}

        // Main application container
        div { 
            class: "flex flex-col min-h-screen bg-gray-900 text-white",
            
            // Header
            header { 
                class: "bg-gray-800 p-4 shadow-md",
                div {
                    class: "container mx-auto flex justify-between items-center",
                    h1 { class: "text-2xl font-bold", "Gardens" }
                    div {
                        class: "flex items-center space-x-4",
                        button { 
                            class: "p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors",
                            // Search icon
                            svg {
                                class: "w-5 h-5",
                                xmlns: "http://www.w3.org/2000/svg",
                                fill: "none",
                                view_box: "0 0 24 24",
                                stroke: "currentColor",
                                path {
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                }
                            }
                        }
                        // User profile icon/avatar
                        div {
                            class: "w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center",
                            span { class: "text-sm font-medium", "U" }
                        }
                    }
                }
            }
            
            // Main content area
            main {
                class: "flex-grow container mx-auto p-4",
                div {
                    class: "bg-gray-800 rounded-lg p-6 shadow-lg",
                    h2 { class: "text-xl font-bold mb-4", "Welcome to Gardens" }
                    p { class: "mb-4", "A secure P2P chat application powered by P2Panda and Willow" }
                    
                    // Demo form (can be replaced with actual functionality)
                    form {
                        class: "mt-6",
                        onsubmit: greet,
                        div {
                            class: "mb-4",
                            label { 
                                class: "block text-gray-300 mb-2", 
                                r#for: "name-input",
                                "Your Name" 
                            }
                            input {
                                id: "name-input",
                                class: "w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none",
                                placeholder: "Enter your name...",
                                value: "{name}",
                                oninput: move |event| name.set(event.value())
                            }
                        }
                        button { 
                            r#type: "submit", 
                            class: "bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition-colors",
                            "Get Started" 
                        }
                    }
                    
                    // Display greeting message
                    p { class: "mt-4 text-green-400", "{greet_msg}" }
                }
            }
            
            // Footer
            footer {
                class: "bg-gray-800 p-4 shadow-inner",
                div {
                    class: "container mx-auto text-center text-gray-400 text-sm",
                    p { "Gardens - Secure P2P Communication" }
                    p { class: "mt-1", "Powered by Tauri, Dioxus, P2Panda, and Willow" }
                }
            }
        }
    }
}