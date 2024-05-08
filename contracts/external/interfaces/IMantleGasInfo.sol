pragma solidity >=0.4.21;


interface IMantleGasInfo {

    // The total gas price the user should pay to have their transactions included
    function gasPrice() external view returns(uint);
}
