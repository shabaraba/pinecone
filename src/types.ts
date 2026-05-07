export interface ImportDeclaration {
  filePath: string;
  alias: string;
  lineIndex: number;
}

export interface ModuleIdentifiers {
  types: string[];
  functions: string[];
  vars: string[];
}
