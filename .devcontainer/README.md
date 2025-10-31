# Dev Container Setup for ASD123.ai Website

This project is configured to run in a Visual Studio Code Dev Container, which means all development tools, dependencies, and the runtime environment are containerized. You don't need to install Node.js or any other tools on your local machine.

## Prerequisites

- **Docker Desktop**: Already installed on your macOS
- **VS Code**: With the "Dev Containers" extension installed

## Getting Started

### Opening the Project in a Dev Container

1. Open this project folder in VS Code
2. VS Code should detect the `.devcontainer` configuration and prompt you to "Reopen in Container"
3. Click "Reopen in Container" (or use Command Palette: `Dev Containers: Reopen in Container`)
4. Wait for the container to build (first time may take a few minutes)
5. Once ready, you'll be working inside the container with all dependencies installed

### Manual Container Rebuild

If you need to rebuild the container (e.g., after changing Dockerfile):
- Command Palette (`Cmd+Shift+P`) → `Dev Containers: Rebuild Container`

## What's Included

The dev container includes:
- **Node.js LTS** - Latest long-term support version
- **npm** - For package management
- **Git** - Version control
- **Zsh with Oh My Zsh** - Enhanced shell experience
- **VS Code Extensions**:
  - ESLint
  - Prettier
  - TypeScript support

## Available Commands

Inside the container, you can use all npm scripts defined in `package.json`:

```bash
# Install dependencies (automatically done on container creation)
npm install

# Start development server (Cloudflare Workers)
npm run dev

# Build the project
npm run build

# Deploy to production
npm run deploy
```

## Port Forwarding

The following ports are automatically forwarded from the container to your local machine:
- **8787** - Cloudflare Workers development server
- **3000** - Alternative development port

You can access your development server at `http://localhost:8787` in your browser.

## How It Works

### Container Structure

- Your project files are mounted into `/workspace` inside the container
- `node_modules` is stored in a Docker volume to prevent conflicts between host and container
- All changes you make in VS Code are immediately reflected in the container
- The container runs as the `node` user (non-root) for security

### File Synchronization

- Your source code is synchronized between your Mac and the container
- Changes made in the container are reflected on your host machine
- Git operations work seamlessly in both environments

## Benefits

✅ **No local installation needed** - Node.js and dependencies only exist in the container  
✅ **Consistent environment** - Same setup works on any machine with Docker  
✅ **Easy reproduction** - Share the `.devcontainer` folder with your team  
✅ **Isolated development** - No conflicts with other projects or system tools  
✅ **Quick cleanup** - Remove the container to clean everything up

## Troubleshooting

### Container won't start
- Ensure Docker Desktop is running
- Check Docker has enough resources allocated (Settings → Resources)
- Try rebuilding: `Dev Containers: Rebuild Container`

### Port already in use
- Check if you have other services running on ports 8787 or 3000
- Stop those services or change the `forwardPorts` in `.devcontainer/devcontainer.json`

### Permission issues
- The container runs as user `node` (UID 1000)
- If you encounter permission issues, check file ownership

### Slow performance on macOS
- Use the `:cached` mount option (already configured)
- Exclude `node_modules` from sync (already configured as volume)

## Customization

### Adding VS Code Extensions

Edit `.devcontainer/devcontainer.json` and add extension IDs to the `extensions` array:

```json
"extensions": [
  "dbaeumer.vscode-eslint",
  "your.extension.id"
]
```

### Changing Node.js Version

Edit `.devcontainer/devcontainer.json` and modify the node feature version:

```json
"ghcr.io/devcontainers/features/node:1": {
  "version": "18"  // or "20", "lts", etc.
}
```

### Installing Additional Tools

Edit `.devcontainer/Dockerfile` and add apt packages or run additional setup commands.

## Stopping and Removing the Container

When you close VS Code, the container continues running in the background. To fully stop and remove:

```bash
# View running containers
docker ps

# Stop the container
docker stop <container-id>

# Remove the container
docker rm <container-id>

# Remove the image (optional)
docker image rm <image-name>
```

Or use Docker Desktop's UI to manage containers.

## Additional Resources

- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Dev Container Specification](https://containers.dev/)
- [Docker Documentation](https://docs.docker.com/)