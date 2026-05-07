import { Command } from 'commander';
import { build } from './builder.js';
import { lint } from './linter.js';

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

program.parse();
