# 59: Use the app's own loadConfig for deploy settings

- Status: in progress (delegated fix task writes this record).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Scope: stage58 findings by removing the script's copy of the configuration rules. No deploy, push or live service access.
