// extension.ts

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as cp from 'child_process';

const ENV_DIR = ".flutter_env";

export function activate(context: vscode.ExtensionContext) {
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = `Flutter Env: Not Active`;
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  async function setupEnvironment() {
    const config = vscode.workspace.getConfiguration('flutterEnv');
    const flutterVersion = config.get<string>('flutterVersion') || "stable";
    const androidPath = config.get<string>('androidSdkPath') || process.env.ANDROID_HOME || detectToolPath("sdkmanager")?.replace(/tools[\\/]bin.*/, "") || "";
    const javaPath = config.get<string>('javaHomePath') || process.env.JAVA_HOME || detectToolPath("javac")?.replace(/bin[\\/]javac.*/, "") || "";
    const envName = config.get<string>('envName') || 'default';

    const envPath = path.join(workspacePath, ENV_DIR, envName);
    const flutterSdkPath = path.join(envPath, 'flutter');

    await fs.ensureDir(envPath);

    if (!fs.existsSync(flutterSdkPath)) {
      vscode.window.showInformationMessage(`Downloading Flutter SDK (${flutterVersion})...`);
      cp.execSync(`git clone https://github.com/flutter/flutter.git -b ${flutterVersion} ${flutterSdkPath}`);
    }

    const envVars = `
export FLUTTER_SDK=${flutterSdkPath}
export PATH=${flutterSdkPath}/bin:$PATH
export ANDROID_HOME=${androidPath}
export JAVA_HOME=${javaPath}
`;

    await fs.writeFile(path.join(workspacePath, `.flutter_envrc_${envName}`), envVars);
    vscode.window.showInformationMessage(`Flutter environment '${envName}' setup complete!`);
  }

  function activateEnvironment() {
    const config = vscode.workspace.getConfiguration('flutterEnv');
    const envName = config.get<string>('envName') || 'default';
    const envPath = path.join(workspacePath, `.flutter_envrc_${envName}`);

    if (fs.existsSync(envPath)) {
      const terminal = vscode.window.createTerminal(`Flutter Env: ${envName}`);
      terminal.sendText(`source ${envPath}`);
      terminal.show();

      const flutterPath = path.join(workspacePath, ENV_DIR, envName, 'flutter', 'bin', 'flutter');
      const flutterVersion = fs.existsSync(flutterPath)
        ? cp.execSync(`${flutterPath} --version`).toString().split('\n')[0]
        : 'Unknown';
      statusBarItem.text = `Flutter Env (${envName}): ${flutterVersion}`;
    } else {
      vscode.window.showErrorMessage("No environment found. Please run Setup first.");
    }
  }

  vscode.window.onDidOpenTerminal((terminal) => {
    const config = vscode.workspace.getConfiguration('flutterEnv');
    const envName = config.get<string>('envName') || 'default';
    const envPath = path.join(workspacePath, `.flutter_envrc_${envName}`);
    if (fs.existsSync(envPath)) {
      terminal.sendText(`source ${envPath}`);
    }
  });

  const treeProvider = new FlutterEnvProvider();
  vscode.window.registerTreeDataProvider("flutterEnvPanel", treeProvider);

  if (vscode.workspace.getConfiguration('flutterEnv').get<boolean>('autoActivate')) {
    activateEnvironment();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('flutter-env.setupEnvironment', setupEnvironment),
    vscode.commands.registerCommand('flutter-env.activate', activateEnvironment)
  );
}

export function deactivate() {}

function detectToolPath(tool: string): string | null {
  try {
    const cmd = process.platform === 'win32' ? `where ${tool}` : `which ${tool}`;
    const output = cp.execSync(cmd).toString().trim();
    return output.split('\n')[0];
  } catch {
    return null;
  }
}

class FlutterEnvItem extends vscode.TreeItem {
  constructor(label: string, command?: vscode.Command) {
    super(label);
    this.command = command;
    this.iconPath = new vscode.ThemeIcon('tools');
  }
}

class FlutterEnvProvider implements vscode.TreeDataProvider<FlutterEnvItem> {
  getTreeItem(element: FlutterEnvItem): vscode.TreeItem {
    return element;
  }

  getChildren(): FlutterEnvItem[] {
    return [
      new FlutterEnvItem("Setup Environment", {
        command: "flutter-env.setupEnvironment",
        title: "Setup Environment"
      }),
      new FlutterEnvItem("Activate Environment", {
        command: "flutter-env.activate",
        title: "Activate Environment"
      })
    ];
  }
}
