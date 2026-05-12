import { Command } from 'commander';
import { build } from './builder.js';
import { lint } from './linter.js';
import { DOCS } from './docs.js';
import { startLsp } from './lsp.js';
import { transpile } from './transpiler.js';

const program = new Command();

program
  .name('pinecone')
  .description('PineScript bundler — inlines imported modules into a single file')
  .version('0.1.0');

program
  .command('build <input>')
  .description('Build a PineScript file with imports resolved')
  .option('-o, --output <file>', 'output file path', 'output.pine')
  .action(async (input: string, options: { output: string }) => {
    try {
      await build({ input, output: options.output });
    } catch (err) {
      console.error('Build failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('lint <input>')
  .description('Check a PineScript file and show what transformations will be applied')
  .action(async (input: string) => {
    try {
      const result = await lint({ input });
      if (!result.ok) process.exit(1);
    } catch (err) {
      console.error('Lint failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('docs')
  .description('Print the LLM development guide for pinecone')
  .action(() => console.log(DOCS));

program
  .command('lsp')
  .description('Start the PineScript LSP server (stdio)')
  .action(() => startLsp());

program
  .command('transpile <input>')
  .description('Transpile PineScript to MQL5 EA format')
  .option('-o, --output <file>', 'output file', 'output.mq5')
  .action(async (input: string, options: { output: string }) => {
    try {
      await transpile({ input, output: options.output });
    } catch (err) {
      console.error('Transpile failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
