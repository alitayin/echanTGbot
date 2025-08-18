const axios = require('axios');

const baseUrl = 'http://ecashrpc.alitayin.com:3080';

async function getAvalanchePeerInfo(proofId) {
  try {
    const response = await axios.get(`${baseUrl}/getavalanchepeerinfo?proofid=${proofId}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function getAvalancheProofs() {
  try {
    const response = await axios.get(`${baseUrl}/getavalancheproofs`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function decodeAvalancheDelegation(delegation) {
  try {
    const response = await axios.get(`${baseUrl}/decodeavalanchedelegation?delegation=${delegation}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function verifyAvalancheDelegation(delegation) {
  try {
    const response = await axios.get(`${baseUrl}/verifyavalanchedelegation?delegation=${delegation}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function decodeAvalancheProof(proof) {
  try {
    const response = await axios.get(`${baseUrl}/decodeavalancheproof?proof=${proof}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function getRawAvalancheProof(proofId) {
  try {
    const response = await axios.get(`${baseUrl}/getrawavalancheproof?proofid=${proofId}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function getStakingReward(blockhash, recompute = false) {
  try {
    const response = await axios.get(`${baseUrl}/getstakingreward?blockhash=${blockhash}&recompute=${recompute}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function verifyAvalancheProof(proof) {
  try {
    const response = await axios.get(`${baseUrl}/verifyavalancheproof?proof=${proof}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function getRemoteProofs(nodeId) {
  try {
    const response = await axios.get(`${baseUrl}/getremoteproofs?nodeid=${nodeId}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

async function getProofStatus(proof) {
  try {
    const response = await axios.get(`${baseUrl}/getproofstatus?proof=${proof}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return `Error: ${error.message || 'An unknown error occurred.'}`;
  }
}

module.exports = {
  getAvalanchePeerInfo,
  getAvalancheProofs,
  decodeAvalancheDelegation,
  verifyAvalancheDelegation,
  decodeAvalancheProof,
  getRawAvalancheProof,
  verifyAvalancheProof,
  getRemoteProofs,
  getStakingReward,
  getProofStatus,
};
