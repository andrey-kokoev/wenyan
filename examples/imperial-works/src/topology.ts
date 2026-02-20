const nodes = [
  'emperor',
  'minister_works',
  'minister_finance',
  'censor_chief',
  'foreman_electrical',
  'foreman_structural',
  'foreman_hydraulic',
  'worker_gateway',
]
console.log(JSON.stringify({ nodes, tiers: 4, topology: 'imperial-works' }))
