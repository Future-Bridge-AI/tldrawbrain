import { existsSync, readFileSync } from 'fs'
import { readFile, writeFile as writeFileUnchecked } from 'fs/promises'
import json5 from 'json5'
import { dirname, join, relative } from 'path'
import prettier from 'prettier'
import { fileURLToPath } from 'url'
import { nicelog } from './nicelog'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const REPO_ROOT = join(__dirname, '../../..')

const _rootPackageJsonPath = join(REPO_ROOT, 'package.json')
if (!existsSync(_rootPackageJsonPath)) {
	throw new Error('expected to find package.json in REPO_ROOT')
}
const _rootPackageJson = JSON.parse(readFileSync(_rootPackageJsonPath, 'utf8'))
if (_rootPackageJson['name'] !== '@tldraw/monorepo') {
	throw new Error('expected to find @tldraw/monorepo in REPO_ROOT package.json')
}

export async function readJsonIfExists(file: string) {
	const fileContents = await readFileIfExists(file)
	if (fileContents === null) {
		return null
	}
	return json5.parse(fileContents)
}

export async function readFileIfExists(file: string) {
	try {
		return await readFile(file, 'utf8')
	} catch {
		return null
	}
}

const prettierConfigPromise = prettier.resolveConfig(__dirname)
export async function writeCodeFile(
	generator: string | null,
	language: 'typescript' | 'javascript',
	filePath: string,
	code: string
) {
	const formattedCode = await prettier.format(
		generator
			? `
				// This file is automatically generated by ${generator}.
				// Do not edit manually. Or do, I'm a comment, not a cop.

				${code}
			`
			: code,
		{
			...(await prettierConfigPromise),
			parser: language === 'typescript' ? 'typescript' : 'babel',
		}
	)
	await writeStringFile(filePath, formattedCode)
}

export async function writeStringFile(filePath: string, contents: string) {
	await writeFile(filePath, Buffer.from(contents, 'utf-8'))
}

export async function writeFile(filePath: string, contents: Buffer) {
	if (process.env.CI && !process.env.ALLOW_REFRESH_ASSETS_CHANGES) {
		let existingContents: Buffer | null = null
		try {
			existingContents = await readFile(filePath)
		} catch {
			// Ignore
		}
		if (existingContents && !existingContents.equals(contents)) {
			nicelog(
				`Asset file ${relative(
					REPO_ROOT,
					filePath
				)} has changed. Please run this script again and commit the changes.`
			)
			nicelog('Contents before:')
			nicelog(existingContents.toString('utf-8'))
			nicelog('\nContents after:')
			nicelog(contents.toString('utf-8'))

			process.exit(1)
		}
	}
	await writeFileUnchecked(filePath, contents, 'utf-8')
}

export async function writeJsonFile(filePath: string, contents: unknown) {
	const formattedJson = await prettier.format(JSON.stringify(contents), {
		...(await prettierConfigPromise),
		parser: 'json',
	})
	await writeStringFile(filePath, formattedJson)
}
