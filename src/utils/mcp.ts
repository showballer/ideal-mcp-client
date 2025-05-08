/**
 * ['--db-path',<dbPath>] => dbPath
 */

import { flatten } from 'lodash';
import {
  MCPArgParameter,
  MCPArgType,
  MCPEnvType,
  IMCPServerParameter,
} from 'types/mcp';

export function getParameters(params: string[]): IMCPServerParameter[] {
  const result: IMCPServerParameter[] = [];
  if (!params) {
    return result;
  }
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  params.forEach((param: string) => {
    const match = param.match(pattern);
    if (match && match.groups) {
      result.push({
        name: match.groups.name,
        type: match.groups.type as MCPEnvType | MCPArgType,
        description: match.groups.description || '',
      });
    }
  });
  return result;
}

export function fillArgs(args: string[], params: MCPArgParameter): string[] {
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  const _args: (string | string[])[] = [...args];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const match = arg.match(pattern);
    if (match && match.groups) {
      const paramValue = params[match.groups.name];
      if (Array.isArray(paramValue)) {
        _args[index] = paramValue;
      } else {
        _args[index] = arg.replace(match[0], paramValue);
      }
    }
  }
  return flatten(_args);
}

export function FillEnv(
  env: Record<string, string> | undefined,
  params: { [key: string]: string },
): Record<string, string> {
  if (!env) return {};
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/g;
  const _env = { ...env };
  const envKeys = Object.keys(env);
  for (const envKey of envKeys) {
    const envItem = env[envKey];
    let result = envItem;
    let match;

    // 使用 while 循环找到所有匹配项并替换
    while ((match = pattern.exec(envItem)) !== null) {
      if (match.groups) {
        const placeholder = match[0]; // 完整的占位符
        const paramValue = params[match.groups.name] || '';
        result = result.replace(placeholder, paramValue);
      }
    }

    _env[envKey] = result;
  }
  return _env;
}
