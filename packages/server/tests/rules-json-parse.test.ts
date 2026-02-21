import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseRulesFromJsonInput } from '@andrey-kokoev/wenyan-shared'

describe('parseRulesFromJsonInput', () => {
  it('parses the rules-to-create fixture', async () => {
    const filePath = fileURLToPath(import.meta.url)
    const fixturePath = resolve(
      dirname(filePath),
      '../../tests/fixtures/rules-to-create-by-pasting.json',
    )
    const raw = await readFile(fixturePath, 'utf8')

    const result = parseRulesFromJsonInput(raw)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.length).toBe(6)
    expect(result.data[0]).toMatchObject({
      code: 'logic:false-cause',
      name: 'False Cause (Post Hoc / Cum Hoc Ergo Propter Hoc)',
    })
  })

  it('parses fenced JSON input', async () => {
    const filePath = fileURLToPath(import.meta.url)
    const fixturePath = resolve(
      dirname(filePath),
      '../../tests/fixtures/rules-to-create-by-pasting.json',
    )
    const raw = await readFile(fixturePath, 'utf8')
    const fenced = `\`\`\`json\n${raw}\n\`\`\``

    const result = parseRulesFromJsonInput(fenced)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.length).toBe(6)
  })
})
