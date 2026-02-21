import { generateGenesisKey } from '../../shared/init-keys'

const key = generateGenesisKey()
console.log(JSON.stringify({ GENESIS_KEY: key }))
