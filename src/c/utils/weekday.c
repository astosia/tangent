#include <pebble.h>
#include "weekday.h"
#include "string.h"
const char* WEEKDAY_ES[] = {
  "DOM",
  "LUN",
  "MAR",
  "MIÉ",
  "JUE",
  "VIE",
  "SÁB",
};
const char* WEEKDAY_EN[] = {
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
};
const char* WEEKDAY_DE[] = {
  "SON",
  "MON",
  "DIE",
  "MIT",
  "DON",
  "FRE",
  "SAM",
};
const char* WEEKDAY_FR[] = {
  "DIM",
  "LUN",
  "MAR",
  "MER",
  "JEU",
  "VEN",
  "SAM",
};
const char* WEEKDAY_PT[] = {
  "DOM",
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SÁB",
};
const char* WEEKDAY_IT[] = {
  "DOM",
  "LUN",
  "MAR",
  "MER",
  "GIO",
  "VEN",
  "SAB",
};
const char* WEEKDAY_SV[] = {
  "SÖN",
  "MÅN",
  "TIS",
  "ONS",
  "TOR",
  "FRE",
  "LÖR",
};
const char* WEEKDAY_NL[] = {
  "ZO.",
  "MA.",
  "DI.",
  "WO.",
  "DO.",
  "VR.",
  "ZA.",
};
const char* WEEKDAY_DA[] = {
  "SØN.", 
  "MAN.", 
  "TIR.", 
  "ONS.", 
  "TOR.", 
  "FRE.", 
  "LØR.",
};
const char* WEEKDAY_NO[] = {
  "SØN.", 
  "MAN.", 
  "TIR.", 
  "ONS.", 
  "TOR.", 
  "FRE.", 
  "LØR.",
};
const char* WEEKDAY_FI[] = {
  "SU", 
  "MA", 
  "TI", 
  "KE", 
  "TO", 
  "PE", 
  "LA",
};//End_Weekday

void fetchwday(int WD, const char* lang, char *iterweekday) {
  if (strcmp(lang,"es_ES")==0) {strcpy(iterweekday, WEEKDAY_ES[WD]);}
  else if (strcmp(lang,"fr_FR")==0) {strcpy(iterweekday, WEEKDAY_FR[WD]);}
  else if (strcmp(lang,"de_DE")==0) {strcpy(iterweekday, WEEKDAY_DE[WD]);}
  else if (strcmp(lang,"pt_PT")==0) {strcpy(iterweekday, WEEKDAY_PT[WD]);}
  else if (strcmp(lang,"it_IT")==0) {strcpy(iterweekday, WEEKDAY_IT[WD]);}
  else if (strcmp(lang,"sv_SE")==0) {strcpy(iterweekday, WEEKDAY_SV[WD]);}
  else if (strcmp(lang,"nl_NL")==0) {strcpy(iterweekday, WEEKDAY_NL[WD]);}
  else if (strcmp(lang,"da_DK")==0) {strcpy(iterweekday, WEEKDAY_DA[WD]);}
  else if (strcmp(lang,"no_NO")==0) {strcpy(iterweekday, WEEKDAY_NO[WD]);}
  else if (strcmp(lang,"fi_FI")==0) {strcpy(iterweekday, WEEKDAY_FI[WD]);}
  else {strcpy(iterweekday, WEEKDAY_EN[WD]);}
}