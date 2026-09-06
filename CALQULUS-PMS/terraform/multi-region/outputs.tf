output "primary_vpc_id" {
  description = "ID of the primary VPC"
  value       = module.primary_vpc.vpc_id
}

output "secondary_vpc_id" {
  description = "ID of the secondary VPC"
  value       = module.secondary_vpc.vpc_id
}

output "primary_cluster_id" {
  description = "ID of the primary EKS cluster"
  value       = module.primary_eks.cluster_id
}

output "primary_cluster_name" {
  description = "Name of the primary EKS cluster"
  value       = module.primary_eks.cluster_name
}

output "primary_cluster_endpoint" {
  description = "Endpoint of the primary EKS cluster"
  value       = module.primary_eks.cluster_endpoint
}

output "secondary_cluster_id" {
  description = "ID of the secondary EKS cluster"
  value       = module.secondary_eks.cluster_id
}

output "secondary_cluster_name" {
  description = "Name of the secondary EKS cluster"
  value       = module.secondary_eks.cluster_name
}

output "secondary_cluster_endpoint" {
  description = "Endpoint of the secondary EKS cluster"
  value       = module.secondary_eks.cluster_endpoint
}

output "primary_region" {
  description = "Primary AWS region"
  value       = var.primary_region
}

output "secondary_region" {
  description = "Secondary AWS region"
  value       = var.secondary_region
}

output "global_accelerator_id" {
  description = "ID of the Global Accelerator"
  value       = aws_globalaccelerator_accelerator.calqulusrms.id
}

output "global_accelerator_dns" {
  description = "DNS name of the Global Accelerator"
  value       = aws_globalaccelerator_accelerator.calqulusrms.dns_name
}

output "route53_zone_id" {
  description = "ID of the Route53 zone"
  value       = aws_route53_zone.primary.zone_id
}

output "primary_kubeconfig" {
  description = "Kubeconfig command to connect to primary cluster"
  value       = "aws eks update-kubeconfig --name ${module.primary_eks.cluster_name} --region ${var.primary_region}"
}

output "secondary_kubeconfig" {
  description = "Kubeconfig command to connect to secondary cluster"
  value       = "aws eks update-kubeconfig --name ${module.secondary_eks.cluster_name} --region ${var.secondary_region}"
}
