variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "consensus_threshold" {
  type    = number
  default = 2
}

variable "genesis_key_ref" {
  type = string
}
