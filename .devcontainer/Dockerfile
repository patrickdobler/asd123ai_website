# Use the official Node.js LTS image as base
FROM node:lts

# Install additional tools and dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    zsh \
    curl \
    wget \
    ca-certificates \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory and set ownership
WORKDIR /workspace
RUN chown -R node:node /workspace

# Set the default shell to zsh for the node user
RUN chsh -s $(which zsh) node

# Switch to node user
USER node

# Keep container running
CMD ["sleep", "infinity"]