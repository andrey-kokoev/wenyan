terraform {
  required_version = ">= 1.5.0"
}

resource "null_resource" "wenyan_node" {
  triggers = {
    instance_type = var.instance_type
    node_id       = var.node_id
  }
}
