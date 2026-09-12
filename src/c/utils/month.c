#include <pebble.h>
#include "month.h"
#include "string.h"

const char* MONTH_ES[] = {
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
};
const char* MONTH_EN[] = {
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
};
const char* MONTH_DE[] = {
  "JAN",
  "FEB",
  "MÄR",
  "APR",
  "MAI",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DEZ",
};
const char* MONTH_FR[] = {
  "JAN",
  "FÉV",
  "MAR",
  "AVR",
  "MAI",
  "JUN",
  "JUL",
  "AOÛ",
  "SEP",
  "OCT",
  "NOV",
  "DÉC",
};
const char* MONTH_PT[] = {
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
};
const char* MONTH_IT[] = {
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
};
const char* MONTH_SV[] = {
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAJ",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DEC",
};
const char* MONTH_NL[] = {
  "JAN.",
  "FEB.",
  "MRT.",
  "APR.",
  "MEI",
  "JUN.",
  "JUL.",
  "AUG.",
  "SEP.",
  "OKT.",
  "NOV.",
  "DEC.",
};
const char* MONTH_DA[] = {
  "JAN.",
  "FEB.",
  "MAR.",
  "APR.",
  "MAJ",
  "JUN.",
  "JUL.",
  "AUG.",
  "SEP.",
  "OKT.",
  "NOV.",
  "DEC.",
};
const char* MONTH_NO[] = {
  "JAN.",
  "FEB.",
  "MAR.",
  "APR.",
  "MAI",
  "JUN.",
  "JUL.",
  "AUG.",
  "SEP.",
  "OKT.",
  "NOV.",
  "DES.",
};
const char* MONTH_FI[] = {
  "TAMMI.",
  "HELMI.",
  "MAALIS.",
  "HUHTI.",
  "TOUKO.",
  "KESÄ.",
  "HEINÄ.",
  "ELO.",
  "SYYS.",
  "LOKA.",
  "MARRAS.",
  "JOULU.",
};

void fetchmonth(int MM, const char* lang, char *itermonth) {
  if (strcmp(lang,"es_ES")==0) {strcpy(itermonth, MONTH_ES[MM]);}
  else if (strcmp(lang,"fr_FR")==0) {strcpy(itermonth, MONTH_FR[MM]);}
  else if (strcmp(lang,"de_DE")==0) {strcpy(itermonth, MONTH_DE[MM]);}
  else if (strcmp(lang,"it_IT")==0) {strcpy(itermonth, MONTH_IT[MM]);}
  else if (strcmp(lang,"pt_PT")==0) {strcpy(itermonth, MONTH_PT[MM]);}
  else if (strcmp(lang,"sv_SE")==0) {strcpy(itermonth, MONTH_SV[MM]);}
  else if (strcmp(lang,"nl_NL")==0) {strcpy(itermonth, MONTH_NL[MM]);}
  else if (strcmp(lang,"da_DK")==0) {strcpy(itermonth, MONTH_DA[MM]);}
  else if (strcmp(lang,"no_NO")==0) {strcpy(itermonth, MONTH_NO[MM]);}
  else if (strcmp(lang,"fi_FI")==0) {strcpy(itermonth, MONTH_FI[MM]);}
  else {strcpy(itermonth, MONTH_EN[MM]);}
}