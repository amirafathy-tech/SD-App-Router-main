
import { Component, OnInit, ViewChild } from '@angular/core';
import { ConfirmationService, Message, MessageService } from 'primeng/api';
import { FormControl, FormGroup, NgForm, Validators } from '@angular/forms';
import { ApiService } from 'src/app/shared/ApiService.service';
import { ServiceMaster } from '../../new-service-master/new-service-master.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceMasterService } from '../new-service-master.service';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-add-edit-service-master',
  templateUrl: './add-edit-service-master.component.html',
  styleUrls: ['./add-edit-service-master.component.css'],
  providers: [ApiService, ServiceMasterService, MessageService, ConfirmationService]
})
export class AddEditServiceMasterComponent implements OnInit {


  displayImportsDialog = false;
  displayExcelDialog = false;
  // Excel Import:
  parsedData: ServiceMaster[] = []; // Parsed data from the Excel file
  displayedColumns: string[] = []; // Column headers from the Excel file

  // imports:
  showImportsDialog() {
    this.displayImportsDialog = true;
  }
  showExcelDialog() {
    this.displayExcelDialog = true;
  }

  onFileSelect(event: any, fileUploader: any) {
    console.log('Records before :', this.parsedData);
    const file = event.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const binaryData = e.target.result;
      const workbook = XLSX.read(binaryData, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (jsonData.length > 0) {
        this.displayedColumns = jsonData[0].filter((col: any) => typeof col === 'string' && col.trim() !== '') as string[];
        this.parsedData = jsonData.slice(1).map((row: any[]) => {
          const rowData: any = {};
          this.displayedColumns.forEach((col, index) => {
            rowData[col] = row[index] !== undefined ? row[index] : '';
          });
          return rowData;
        });
        console.log('Records :', this.parsedData);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Records copied from the excel sheet successfully!',
          life: 4000
        });

        
      // After showing success → ask for confirmation
      setTimeout(() => {
        this.confirmationService.confirm({
          message: 'Do you want to save the copied records?',
          header: 'Confirm Save',
          icon: 'pi pi-question-circle',
          accept: () => {
            // Loop through parsedData and call service
            this.parsedData.forEach(record => {
              this.saveServiceMasterFromExcel(record)
              // .subscribe({
              //   next: () => console.log('Saved:', record),
              //   error: (err) => console.error('Error saving:', record, err)
              // });
            });
            this.messageService.add({
              severity: 'info',
              summary: 'Saved',
              detail: 'All records have been saved.'
            });
          },
          reject: () => {
            this.messageService.add({
              severity: 'warn',
              summary: 'Cancelled',
              detail: 'Records were not saved.'
            });
          }
        });
      }, 500);

      } else {
        this.displayedColumns = [];
        this.parsedData = [];
      }
      // Reset the file input using the PrimeNG method
      fileUploader.clear();
    };
    reader.readAsBinaryString(file);
  }

  // for selected from excel sheet:
  saveServiceMasterFromExcel(serviceMaster: ServiceMaster) {
    console.log(serviceMaster);
     const newRecord = new ServiceMaster(serviceMaster.searchTerm, serviceMaster.description,
        serviceMaster.serviceText, serviceMaster.shortTextChangeAllowed,
        serviceMaster.deletionIndicator, serviceMaster.mainItem, serviceMaster.numberToBeConverted,
        serviceMaster.convertedNumber,
        serviceMaster.serviceTypeCode, serviceMaster.materialGroupCode,
        serviceMaster.baseUnitOfMeasurement, serviceMaster.toBeConvertedUnitOfMeasurement, serviceMaster.defaultUnitOfMeasurement);

      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ServiceMaster>('servicenumbers', filteredRecord).subscribe({
        next: (res: ServiceMaster) => {
          console.log('service master created:', res);

        }, error: (err) => {
          console.log(err);

        }, complete: () => {
          this.confirmationService.confirm({
            message: `All Records Added successfully. Click Yes to go to the Main Page.`,
            header: 'Added Successfully',
            icon: 'pi pi-check',
            accept: () => {
              this.router.navigate(['/servicemaster']);
            },
            reject: () => {
            }
          });
        }
      })
   
  }
  cancelFromExcel(item: any): void {
    this.parsedData = this.parsedData.filter(i => i !== item);
  }


  serviceMasterForm = new FormGroup({
    serviceNumberCode: new FormControl(0),
    searchTerm: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    serviceText: new FormControl(''),
    shortTextChangeAllowed: new FormControl(false),
    deletionIndicator: new FormControl(false),
    numberToBeConverted: new FormControl(0),
    convertedNumber: new FormControl(0),
    mainItem: new FormControl(false),
    serviceTypeCode: new FormControl('', [Validators.required]),
    materialGroupCode: new FormControl(''),
    baseUnitOfMeasurement: new FormControl('',[Validators.required]),
    toBeConvertedUnitOfMeasurement: new FormControl(''),
    defaultUnitOfMeasurement: new FormControl(''),
  });

  editMode = false;
  copyMode = false
  pageId: number = 0;

  serviceMasterInfo: ServiceMaster = {
    serviceNumberCode: 0, searchTerm: '', description: '', serviceText: '', shortTextChangeAllowed: false, deletionIndicator: false,
    numberToBeConverted: 0, convertedNumber: 0, mainItem: false,
    serviceTypeCode: '', materialGroupCode: '',
    baseUnitOfMeasurement: '', toBeConvertedUnitOfMeasurement: '', defaultUnitOfMeasurement: ''
  };

  // Fields of Dropdowns:
  recordsServiceType!: any[];
  selectedServiceType!: number;
  recordsMeasure!: any[];
  selectedBaseMeasure!: number;
  baseUnitOfMeasurement!: string;
  selectedToBeConvertedMeasure!: string;
  selectedConvertedMeasure!: string;
  recordsMaterialGrp!: any[];
  selectedMaterialGrp!: number;

  constructor(private apiService: ApiService, private serviceMasterService: ServiceMasterService
    , private messageService: MessageService, private router: Router, private confirmationService: ConfirmationService, private route: ActivatedRoute) {

    if (this.router.getCurrentNavigation()?.extras.state) {
      const state = this.router.getCurrentNavigation()?.extras.state?.['Record'];
      const copyFlag = this.router.getCurrentNavigation()?.extras.state?.['Copy'];
      if (copyFlag) {
        this.serviceMasterInfo = state;
        this.copyMode = copyFlag;
        this.pageId = state?.serviceNumberCode;
        console.log(this.serviceMasterInfo);

      } else {
        this.serviceMasterInfo = state;
        this.editMode = true;
        this.pageId = state?.serviceNumberCode;
        console.log(this.serviceMasterInfo);

      }
    }
  }

  ngOnInit() {
    this.apiService.get<any[]>('servicetypes').subscribe(response => {
      this.recordsServiceType = response;
    });
    this.apiService.get<any[]>('measurements').subscribe(response => {
      this.recordsMeasure = response;
    });
    this.apiService.get<any[]>('materialgroups').subscribe(response => {
      this.recordsMaterialGrp = response;
    });

    if (this.editMode || this.copyMode) {
      this.getServiceMasterById(this.pageId)
    }
  }

  getServiceMasterById(id: number) {
    // this.apiService.getID<ServiceMaster>('servicenumbers',id).subscribe({
    // next: (res: ServiceMaster) => {
    //   console.log(res);
    //   this.serviceMasterInfo = res;
    // }, error: (err: any) => {
    //   console.log(err);

    // }, complete: () => {
    if (this.serviceMasterInfo) {
      this.serviceMasterForm.patchValue({
        serviceNumberCode: this.serviceMasterInfo?.serviceNumberCode,
        searchTerm: this.serviceMasterInfo?.searchTerm,
        description: this.serviceMasterInfo?.description,
        serviceText: this.serviceMasterInfo?.serviceText,
        shortTextChangeAllowed: this.serviceMasterInfo?.shortTextChangeAllowed,
        deletionIndicator: this.serviceMasterInfo?.deletionIndicator,
        serviceTypeCode: this.serviceMasterInfo?.serviceTypeCode,
        baseUnitOfMeasurement: this.serviceMasterInfo?.baseUnitOfMeasurement,
        numberToBeConverted: this.serviceMasterInfo?.numberToBeConverted,
        toBeConvertedUnitOfMeasurement: this.serviceMasterInfo?.toBeConvertedUnitOfMeasurement,
        convertedNumber: this.serviceMasterInfo?.convertedNumber,
        defaultUnitOfMeasurement: this.serviceMasterInfo?.defaultUnitOfMeasurement,
        mainItem: this.serviceMasterInfo?.mainItem,
        materialGroupCode: this.serviceMasterInfo?.materialGroupCode

      })
    }// end if
    // }
    //})
  }

  onSubmit(form: FormGroup) {
    const value = form.value;
    console.log(value);
    if (this.editMode) {
      this.serviceMasterService.updateRecord(this.pageId, form.value);
      this.serviceMasterService.getRecords();
      this.confirmationService.confirm({
        message: `ServiceMaster ${this.pageId} Updated successfully. Click Yes to go to the Main Page.`,
        header: 'Updated Successfully',
        icon: 'pi pi-check',
        accept: () => {
          this.router.navigate(['/servicemaster']);
        },
        reject: undefined
      });

    } else {
      const newRecord = new ServiceMaster(value.searchTerm, value.description,
        value.serviceText, value.shortTextChangeAllowed,
        value.deletionIndicator, value.mainItem, value.numberToBeConverted,
        value.convertedNumber,
        value.serviceTypeCode, value.materialGroupCode,
        value.baseUnitOfMeasurement, value.toBeConvertedUnitOfMeasurement, value.defaultUnitOfMeasurement);

      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this.apiService.post<ServiceMaster>('servicenumbers', filteredRecord).subscribe({
        next: (res: ServiceMaster) => {
          console.log('service master created:', res);

        }, error: (err) => {
          console.log(err);

        }, complete: () => {
          this.confirmationService.confirm({
            message: `ServiceMaster  Added successfully. Click Yes to go to the Main Page.`,
            header: 'Added Successfully',
            icon: 'pi pi-check',
            accept: () => {
              this.router.navigate(['/servicemaster']);
            },
            reject: () => {
            }
          });
        }
      })
    }
  }
}


