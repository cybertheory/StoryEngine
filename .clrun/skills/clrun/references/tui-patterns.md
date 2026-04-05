# TUI Interaction Patterns — Real-World Examples

Complete walkthroughs of driving interactive CLI tools with \`clrun\`.

## Example: create-vue (Vue.js scaffolder)

\`\`\`bash
clrun "npx create-vue@latest"
clrun <id> "my-vue-app"
clrun key <id> space down down space down space down down down space down down enter
clrun key <id> enter
clrun key <id> enter
clrun <id> "cd my-vue-app && npm install"
clrun <id> "npm run dev"
\`\`\`

## Example: create-vite (React + TypeScript)

\`\`\`bash
clrun "npx create-vite@latest"
clrun <id> "my-react-app"
clrun key <id> down down enter
clrun key <id> enter
clrun key <id> enter
\`\`\`

## Example: npm init (readline prompts)

\`\`\`bash
clrun "npm init"
clrun <id> "my-package"
clrun <id> ""
clrun <id> "A cool project"
clrun <id> ""
clrun <id> "vitest run"
clrun <id> ""
clrun <id> "cli,agent,terminal"
clrun <id> "myname"
clrun <id> "MIT"
clrun <id> "yes"
\`\`\`

## Example: Long-running dev server

\`\`\`bash
clrun "npm run dev"
clrun tail <id> --lines 20
clrun kill <id>
\`\`\`

## Example: Interrupting a process

\`\`\`bash
clrun key <id> ctrl-c
clrun tail <id> --lines 10
clrun kill <id>
\`\`\`

## Example: Environment variable persistence

\`\`\`bash
clrun "bash"
clrun <id> "export API_KEY=sk-12345"
clrun <id> 'echo $API_KEY'
# Sessions auto-suspend after 5 min idle and auto-restore on input
\`\`\`

## Pattern: Priority queuing

\`\`\`bash
clrun "npm init"
clrun input <id> "my-package" --priority 10
clrun input <id> "" --priority 9
clrun input <id> "Description" --priority 8
clrun input <id> "MIT" --priority 2
clrun input <id> "yes" --priority 1
\`\`\`

## Pattern: Override for recovery

\`\`\`bash
clrun input <id> "n" --override
clrun key <id> ctrl-c
\`\`\`
