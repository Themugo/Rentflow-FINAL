terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "s3" {
    bucket         = "calqulusrms-terraform-state"
    key            = "calqulusrms/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "calqulusrms-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CALQULUS RMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
  token                  = data.aws_eks_cluster_auth.this.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}

data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${var.project_name}-${var.environment}-cluster"
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.large", "t3a.large"]
      min_size       = 3
      max_size       = 10
      desired_size   = 3

      labels = {
        role = "general"
      }

      taints = []
    }

    compute = {
      name           = "compute"
      instance_types = ["t3.xlarge", "t3a.xlarge"]
      min_size       = 2
      max_size       = 20
      desired_size   = 2

      labels = {
        role = "compute"
      }

      taints = []
    }
  }

  cluster_security_group_additional_rules = {
    ingress_nodes_ephemeral_ports_tcp = {
      description                = "Nodes on ephemeral ports"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }

  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
  }

  tags = {
    Environment = var.environment
  }
}

module "helm_release" {
  source  = "terraform-module/release/helm"
  version = "2.0.0"

  namespace = "calqulusrms"

  repository = "oci://ghcr.io/calqulusrms/charts"
  chart      = "calqulusrms"
  version    = "1.0.0"

  name = "calqulusrms"

  values = [
    templatefile("${path.module}/helm-values.yaml", {
      environment = var.environment
      domain      = var.domain
    })
  ]

  set = [
    {
      name  = "image.tag"
      value = var.app_version
    }
  ]
}
