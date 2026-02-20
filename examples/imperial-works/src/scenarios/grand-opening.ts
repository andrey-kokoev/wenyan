import { emergencyDrill } from './emergency-drill'
import { offlineForemanSync } from './offline-foreman'

console.log(JSON.stringify({ drill: emergencyDrill(), sync: offlineForemanSync() }))
