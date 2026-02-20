variable "instance_type" {
  type        = string
  description = "Compute instance type"
  default     = "t3.small"
}

variable "node_id" {
  type        = string
  description = "Wenyan node identifier"
}

variable "consensus_threshold" {
  type        = number
  description = "Consensus threshold"
  default     = 1
}

variable "genesis_key_ref" {
  type        = string
  description = "KMS or secret reference for genesis key"
}
