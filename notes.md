
move buffer to be the bigh memory of CODE
we need a low pointer to mark the start of the buffer, eg BP, the high point is the CP
once parsed and executed the space can be freed again
EXCEPT if there has been a clode block {} this will mena that there may be a pointer referrring to it. In which case the code needs to be preserved. If so the BP can be set to the new CP and the buffer starts from there
This unifies the two targets for compilation and gets rid of the parseMode
The need to preserve can be triggered by a "{" which can set a variable on vm (vm.preserve)