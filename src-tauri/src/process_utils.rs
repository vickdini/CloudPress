pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Create a new `tokio::process::Command` configured with `CREATE_NO_WINDOW` on Windows
/// to prevent console command prompt windows from popping up.
pub fn tokio_command(program: impl AsRef<std::ffi::OsStr>) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Create a new `std::process::Command` configured with `CREATE_NO_WINDOW` on Windows
/// to prevent console command prompt windows from popping up.
pub fn std_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
