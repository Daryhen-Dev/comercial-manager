// PM2 process description for this Next.js app on Windows.
//
// Same shape as comercial-web's file, on purpose: `script: "cmd"` with
// `args: "/c node_modules\\.bin\\next.cmd start"`. PM2 cannot execute the
// generated `.cmd` shim by itself, so it has to be run through cmd.exe.
//
// `cwd` is the deployment folder, NOT the repository. Adjust it if this app
// lands somewhere other than C:\apps\comercial-manager.
//
// The PORT has to differ from comercial-web's (3000 on this machine, and 80 is
// already held by http.sys). Two PM2 apps may share the daemon and the machine,
// but never a listening port.
//
// Credentials are NOT here. `next start` loads `.env` (and `.env.local` before
// it) from `cwd`, which is where DATABASE_URL and AUTH_SECRET must live on the
// target machine.
module.exports = {
  apps: [
    {
      name: "comercial-manager",
      script: "cmd",
      args: "/c node_modules\\.bin\\next.cmd start",
      cwd: "C:\\apps\\comercial-manager",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // One process only: Next keeps its own caches in memory, so fork mode
      // (the default) with a single instance is what `next start` expects.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // Timestamps in ~/.pm2/logs/comercial-manager-*.log
      time: true,
    },
  ],
}
