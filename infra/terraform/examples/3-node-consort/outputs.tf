output "nodes" {
  value = [module.node_a.node_id, module.node_b.node_id, module.node_c.node_id]
}
