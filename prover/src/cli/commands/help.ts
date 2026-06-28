/**
 * Zer0Inf — help Command
 */

interface CLIArgs {
  command: string;
  positional: string[];
  options: Record<string, string | boolean>;
}

export async function cmdHelp(_args: CLIArgs): Promise<void> {
  console.log(`
zer0Inf — Zero-Knowledge Proof of AI Inference on Stellar Soroban

USAGE:
  zer0inf <command> [options]

COMMANDS:
  register <weights.json>    Compute weight hash + save metadata
    --description <text>     Model description
    
  deploy                     Print Stellar testnet deployment instructions
    --secret <key>           Stellar secret key (or via STELLAR_SECRET)
    
  submit --proof <path>      Submit proof to on-chain contract
    --contract-id <id>       Contract ID (required if not stored)
    --secret <key>           Stellar secret key
    --rpc <url>              Custom RPC URL
    
  infer [options]            Run inference & generate ZK proof
    --input <path>           Input data JSON file
    --weights-path <path>    Weights JSON (default: demo weights)
    
  verify --proof <path>      Verify proof locally
  
  export-vk                  Extract UltraHonk verification key from circuit
  
  status                     Show project state

EXAMPLES:
  # Generate ZK proof locally
  zer0inf infer
  
  # Deploy contract to testnet (prints instructions)
  zer0inf deploy --secret <your_secret_key>
  
  # Submit proof to deployed contract
  zer0inf submit --proof output/proof.json --contract-id <contract_id> --secret <key>
`);
}
