use dioxus::prelude::*;

#[component]
pub fn Stylesheet() -> Element {
    rsx! {
        link {
            rel: "stylesheet",
            href: "/css/tailwind.css"
        }
    }
} 