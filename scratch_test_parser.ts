import { AccountParser } from './packages/shared/src/account.parser';

const row = [
  "62",
  "jviw159zdu",
  "Thanhtu1808@",
  "mqzpinita@hotmail.com",
  "TpDLljD5tCW1f3",
  "M.C515_BAY.0.U.-CiUxC4Agquunrwh483Z0Xy*a8QR0xro0sP7wtdJXl5HhJUJHV3kHP3bavnDsxbJRxNJ3Ejy0y3TcSOOQED6GihRYOs7P6QUOp9QmQx7e42T84yHFD6Arwacewz!73NCMMdfBesn1JepOW8yrY6Fh7blDoMIFHlUP0Pxu8jD1LoVGCGXqhvN*rnOpVDoGY75!YLdXGXSX577JqQ90ILmaocbmngVGNbj6NCASwfPymmwJoZ7QcpvNwtdOsCZGOzwWDCZ1JFICW1iWNSWJhnzPXsqc*0Q230S2dDkgCyD7rmF2uHMxb8BXbokWc12BwNmAwTli9Rw9gioGLaUA9hHgC1MAIedrnfyKIb1UR2nt8R8F5cfOqrnSroNjhDbC*NDYV9VXd5kJXFbZVFuztRsvijErIocPPfMNVEciTkFReZ4p|9e5f94bc-e8a4-4e73-b8be-63364c29d753"
];

const result = AccountParser.parseRow(row, 1);
console.log(JSON.stringify(result, null, 2));
