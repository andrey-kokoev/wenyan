import { describe, expect, it } from 'vitest'
import { PbftConsensus } from './index'

describe('pbft consensus', () => {
  it('commits only after prepare+commit threshold', () => {
    const pbft = new PbftConsensus({ replicaSet: ['n1', 'n2', 'n3'], threshold: 2 })
    pbft.proposeTiDefinition('p1', 'n1')
    pbft.onPrepare({ proposalId: 'p1', viewNo: 0, nodeId: 'n1', phase: 'prepare', signature: 's', at: new Date().toISOString() })
    pbft.onPrepare({ proposalId: 'p1', viewNo: 0, nodeId: 'n2', phase: 'prepare', signature: 's', at: new Date().toISOString() })
    expect(pbft.commitIfThreshold('p1')).toBe(false)
    pbft.onCommit({ proposalId: 'p1', viewNo: 0, nodeId: 'n1', phase: 'commit', signature: 's', at: new Date().toISOString() })
    pbft.onCommit({ proposalId: 'p1', viewNo: 0, nodeId: 'n2', phase: 'commit', signature: 's', at: new Date().toISOString() })
    expect(pbft.commitIfThreshold('p1')).toBe(true)
  })

  it('advances view on view-change', () => {
    const pbft = new PbftConsensus({ replicaSet: ['n1', 'n2', 'n3'], threshold: 2 })
    expect(pbft.currentView()).toBe(0)
    pbft.onViewChange('n2')
    expect(pbft.currentView()).toBe(1)
  })
})
