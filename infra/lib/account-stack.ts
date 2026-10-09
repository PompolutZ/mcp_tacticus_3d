import { Stack, type StackProps } from 'aws-cdk-lib'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

const GITHUB_ISSUER = 'token.actions.githubusercontent.com'
// Immutable subject format: repo id and owner id are part of it.
const GITHUB_SUB = 'repo:PompolutZ@927235/mcp_tacticus_3d@1391287590:environment:prod'

export interface AccountStackProps extends StackProps {
  budgetEmail: string
  githubOidcProvider: 'create' | 'import'
}

export class AccountStack extends Stack {
  constructor(scope: Construct, id: string, props: AccountStackProps) {
    super(scope, id, props)

    // Both roles may only assume the CDK bootstrap roles.
    const assumeBootstrapRoles = new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      conditions: {
        StringEquals: {
          'iam:ResourceTag/aws-cdk:bootstrap-role': [
            'deploy',
            'file-publishing',
            'image-publishing',
            'lookup',
          ],
        },
      },
    })

    // Trusts the account, so no IAM user is named. The admin user's own policy allows the assume.
    new iam.Role(this, 'DeployerRole', {
      roleName: 'mcptacticus-deployer',
      assumedBy: new iam.AccountRootPrincipal().withConditions({
        Bool: { 'aws:MultiFactorAuthPresent': 'true' },
      }),
      inlinePolicies: {
        Deploy: new iam.PolicyDocument({
          statements: [
            assumeBootstrapRoles,
            new iam.PolicyStatement({
              actions: [
                'ssm:PutParameter',
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
                'ssm:DeleteParameter',
              ],
              resources: ['parameter/mcptacticus', 'parameter/mcptacticus/*'].map((resourceName) =>
                this.formatArn({ service: 'ssm', resource: resourceName }),
              ),
            }),
          ],
        }),
      },
    })

    // An account can have one provider for this issuer.
    const provider =
      props.githubOidcProvider === 'create'
        ? new iam.OidcProviderNative(this, 'GithubOidc', {
            url: `https://${GITHUB_ISSUER}`,
            clientIds: ['sts.amazonaws.com'],
          })
        : iam.OidcProviderNative.fromOidcProviderArn(
            this,
            'GithubOidc',
            `arn:aws:iam::${this.account}:oidc-provider/${GITHUB_ISSUER}`,
          )

    new iam.Role(this, 'CiRole', {
      roleName: 'mcptacticus-github-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: {
          [`${GITHUB_ISSUER}:aud`]: 'sts.amazonaws.com',
          [`${GITHUB_ISSUER}:sub`]: GITHUB_SUB,
        },
      }),
      inlinePolicies: {
        Deploy: new iam.PolicyDocument({ statements: [assumeBootstrapRoles] }),
      },
    })

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.budgetEmail }]
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetName: 'mcptacticus-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 1, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    })
  }
}
