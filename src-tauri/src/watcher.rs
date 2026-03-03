use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

type WatcherHandle = notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>;

pub struct SaveWatcher {
    handle: Mutex<Option<WatcherHandle>>,
    watching_path: Mutex<String>,
}

impl SaveWatcher {
    pub fn new() -> Self {
        Self {
            handle: Mutex::new(None),
            watching_path: Mutex::new(String::new()),
        }
    }

    pub fn start(&self, save_dir: &str, app: AppHandle) {
        let dir = save_dir.to_string();

        if !Path::new(&dir).is_dir() {
            return;
        }

        {
            let current = self.watching_path.lock().unwrap();
            if *current == dir {
                return;
            }
        }

        self.stop();

        let app = Arc::new(app);

        let debouncer = new_debouncer(Duration::from_secs(2), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if let Ok(events) = res {
                let dominated_by_sav = events.iter().any(|e| {
                    e.kind == DebouncedEventKind::Any
                        && e.path
                            .extension()
                            .map(|ext| ext == "sav")
                            .unwrap_or(false)
                });
                if dominated_by_sav {
                    let _ = app.emit("save-file-changed", ());
                }
            }
        });

        match debouncer {
            Ok(mut watcher) => {
                if watcher
                    .watcher()
                    .watch(Path::new(&dir), RecursiveMode::NonRecursive)
                    .is_ok()
                {
                    *self.watching_path.lock().unwrap() = dir;
                    *self.handle.lock().unwrap() = Some(watcher);
                }
            }
            Err(_) => {}
        }
    }

    pub fn stop(&self) {
        let mut handle = self.handle.lock().unwrap();
        *handle = None;
        *self.watching_path.lock().unwrap() = String::new();
    }
}
