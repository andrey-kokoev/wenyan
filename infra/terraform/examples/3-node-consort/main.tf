terraform {
  required_version = ">= 1.5.0"
}

module "node_a" {
  source              = "../../modules/wenyan-node"
  node_id             = "node-a"
  instance_type       = var.instance_type
  consensus_threshold = var.consensus_threshold
  genesis_key_ref     = var.genesis_key_ref
}

module "node_b" {
  source              = "../../modules/wenyan-node"
  node_id             = "node-b"
  instance_type       = var.instance_type
  consensus_threshold = var.consensus_threshold
  genesis_key_ref     = var.genesis_key_ref
}

module "node_c" {
  source              = "../../modules/wenyan-node"
  node_id             = "node-c"
  instance_type       = var.instance_type
  consensus_threshold = var.consensus_threshold
  genesis_key_ref     = var.genesis_key_ref
}
